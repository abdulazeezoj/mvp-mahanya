"""Generate labelled training sequences from a calibrated SUMO scenario.

Drives the same rule-based `Controller` used at runtime, but with a
longest-queue heuristic standing in for the transformer as the model under
imitation; the scheduler still owns min/max green, transitions,
anti-starvation, and emergency pre-emption, so the label the transformer
eventually learns to imitate is "the safety-scheduler-validated outcome of
a longest-queue heuristic," not a raw unfiltered heuristic recommendation.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import pandas as pd

from mahanya.config import SchedulerThresholds
from mahanya.scheduler.controller import Controller
from mahanya.schemas import ApproachDirection, Phase, PhaseRecommendation, TrafficState
from mahanya.sumo.traci_client import TraciClient

DIRECTIONS: tuple[ApproachDirection, ...] = ("north", "south", "east", "west")


class LongestQueueOracle:
    """Recommends green for whichever approach currently has the longest
    queue: the imitation-learning target for `PhaseTransformer`."""

    def predict(self, history: Sequence[TrafficState]) -> PhaseRecommendation:
        latest = history[-1]
        direction = max(DIRECTIONS, key=lambda d: latest.approaches.get(d).queue_length)
        recommended_phase: Phase = f"{direction.upper()}_GREEN"  # type: ignore[assignment]
        return PhaseRecommendation(recommended_phase=recommended_phase, confidence=1.0)


def _flatten(state: TrafficState, applied_phase: Phase) -> dict[str, object]:
    row: dict[str, object] = {
        "scenario_id": state.scenario_id,
        "tick": state.tick,
        "active_phase": state.active_phase,
        "elapsed_phase_time_sec": state.elapsed_phase_time_sec,
        "applied_phase": applied_phase,
    }
    for direction in DIRECTIONS:
        approach = state.approaches.get(direction)
        row[f"{direction}_vehicle_count"] = approach.vehicle_count
        row[f"{direction}_queue_length"] = approach.queue_length
        row[f"{direction}_waiting_time_sec"] = approach.waiting_time_sec
        row[f"{direction}_has_emergency_vehicle"] = approach.has_emergency_vehicle
    return row


def generate_sequences(
    sumocfg: Path,
    scenario_id: str,
    num_ticks: int,
    thresholds: SchedulerThresholds,
    dt: float,
    seed: int,
    output: Path,
) -> int:
    """Run `num_ticks` of a calibrated scenario, writing one labelled row
    per tick to a Parquet file. Returns the number of rows written."""

    client = TraciClient(
        sumocfg, seed=seed, step_length=dt, label=f"sequence-gen-{scenario_id}-{seed}"
    )
    client.start()
    controller = Controller(thresholds, dt=dt, model=LongestQueueOracle())
    rows: list[dict[str, object]] = []
    try:
        for t in range(num_ticks):
            traffic = client.observe(scenario_id, t)
            decision = controller.step(traffic)
            rows.append(_flatten(traffic, decision.applied_phase))
            client.apply(decision.applied_phase)
            client.advance()
    finally:
        client.close()

    df = pd.DataFrame(rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output, index=False)
    return len(df)
