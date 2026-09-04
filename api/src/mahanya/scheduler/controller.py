"""One control-loop tick: observe -> predict -> validate -> apply -> log.

``Controller`` is the only place that is allowed to reach into both a SUMO
client and a model; everything downstream of it only ever sees the
deterministic :class:`~mahanya.schemas.SchedulerDecision` output. Both
collaborators are consumed through structural (``Protocol``) interfaces so
this module, and its tests, never need a real TraCI connection or a loaded
PyTorch model.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from mahanya.config import SchedulerThresholds
from mahanya.scheduler.rules import ControllerState, initial_state, tick
from mahanya.schemas import (
    DecisionLogRecord,
    Phase,
    PhaseRecommendation,
    SchedulerDecision,
    TrafficState,
)

logger = logging.getLogger(__name__)


class SumoClient(Protocol):
    def observe(self, scenario_id: str, tick: int) -> TrafficState: ...

    def apply(self, phase: Phase) -> None: ...

    def advance(self) -> None: ...


class PhaseRecommender(Protocol):
    def predict(self, history: Sequence[TrafficState]) -> PhaseRecommendation: ...


class Controller:
    """Drives one calibrated scenario, one tick at a time."""

    def __init__(
        self,
        thresholds: SchedulerThresholds,
        dt: float,
        model: PhaseRecommender | None = None,
        start_phase: Phase = "NORTH_GREEN",
        sequence_length: int = 16,
        decision_log_path: Path | None = None,
    ) -> None:
        self._thresholds = thresholds
        self._dt = dt
        self._model = model
        self._state: ControllerState = initial_state(start_phase)
        self._sequence_length = sequence_length
        self._history: list[TrafficState] = []
        self._decision_log_path = decision_log_path
        if decision_log_path is not None:
            decision_log_path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def state(self) -> ControllerState:
        return self._state

    def step(self, traffic: TrafficState) -> SchedulerDecision:
        """Run one tick given an already-observed :class:`TrafficState`."""

        recommendation = self._predict(traffic)
        self._state, decision = tick(
            self._state, traffic, recommendation, self._thresholds, self._dt
        )
        self._remember(traffic)
        self._log(traffic, decision)
        return decision

    def run(self, client: SumoClient, scenario_id: str, num_ticks: int) -> list[SchedulerDecision]:
        """Drive ``num_ticks`` of a live SUMO scenario end to end."""

        decisions: list[SchedulerDecision] = []
        for t in range(num_ticks):
            traffic = client.observe(scenario_id, t)
            decision = self.step(traffic)
            client.apply(decision.applied_phase)
            client.advance()
            decisions.append(decision)
        return decisions

    def _predict(self, traffic: TrafficState) -> PhaseRecommendation | None:
        from mahanya.scheduler.rules import detect_emergency

        if self._model is None or detect_emergency(traffic) is not None:
            return None
        try:
            window = [*self._history, traffic][-self._sequence_length :]
            return self._model.predict(window)
        except Exception:
            logger.exception("Model inference failed; falling back to deterministic hold.")
            return None

    def _remember(self, traffic: TrafficState) -> None:
        self._history.append(traffic)
        if len(self._history) > self._sequence_length:
            self._history = self._history[-self._sequence_length :]

    def _log(self, traffic: TrafficState, decision: SchedulerDecision) -> None:
        if self._decision_log_path is None:
            return
        record = DecisionLogRecord(state=traffic, decision=decision)
        with self._decision_log_path.open("a") as f:
            f.write(record.model_dump_json(by_alias=True))
            f.write("\n")
