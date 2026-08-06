"""Tests for `Controller`'s tick orchestration: model fallback on failure,
emergency short-circuit skipping inference, decision logging, and driving a
fake `SumoClient`.
"""

from __future__ import annotations

import json

from mahanya.scheduler.controller import Controller
from mahanya.schemas import Phase, PhaseRecommendation, TrafficState
from tests.fixtures.traffic import make_traffic_state


class FakeSumoClient:
    """A minimal stand-in for `mahanya.sumo.TraciClient`, no SUMO required."""

    def __init__(self, num_ticks: int) -> None:
        self.num_ticks = num_ticks
        self.applied_phases: list[Phase] = []
        self.advanced = 0

    def observe(self, scenario_id: str, tick: int) -> TrafficState:
        return make_traffic_state(tick=tick, scenario_id=scenario_id)

    def apply(self, phase: Phase) -> None:
        self.applied_phases.append(phase)

    def advance(self) -> None:
        self.advanced += 1


class AlwaysRecommend:
    def __init__(self, phase: Phase) -> None:
        self.phase = phase
        self.calls = 0

    def predict(self, history):
        self.calls += 1
        return PhaseRecommendation(recommended_phase=self.phase, confidence=0.9)


class ExplodingModel:
    def predict(self, history):
        raise RuntimeError("inference backend unavailable")


def test_controller_step_without_model_falls_back_to_hold(thresholds):
    controller = Controller(thresholds, dt=1.0, model=None)
    traffic = make_traffic_state(tick=0)
    decision = controller.step(traffic)
    assert decision.recommendation is None
    assert decision.applied_phase == "NORTH_GREEN"
    assert decision.reason_code == "model_accepted"


def test_controller_step_model_exception_falls_back_safely(thresholds):
    controller = Controller(thresholds, dt=1.0, model=ExplodingModel())
    traffic = make_traffic_state(tick=0)
    decision = controller.step(traffic)  # must not raise
    assert decision.recommendation is None
    assert decision.applied_phase == "NORTH_GREEN"


def test_controller_step_skips_model_during_emergency(thresholds):
    model = AlwaysRecommend("EAST_GREEN")
    controller = Controller(thresholds, dt=1.0, model=model)
    traffic = make_traffic_state(tick=0, emergency_direction="south")
    controller.step(traffic)
    assert model.calls == 0


def test_controller_step_consults_model_when_no_emergency(thresholds):
    model = AlwaysRecommend("EAST_GREEN")
    controller = Controller(thresholds, dt=1.0, model=model)
    traffic = make_traffic_state(tick=0)
    decision = controller.step(traffic)
    assert model.calls == 1
    assert decision.recommendation is not None
    assert decision.recommendation.recommended_phase == "EAST_GREEN"


def test_controller_run_drives_fake_client_for_num_ticks(thresholds):
    controller = Controller(thresholds, dt=1.0, model=None)
    client = FakeSumoClient(num_ticks=10)
    decisions = controller.run(client, scenario_id="fake-scenario", num_ticks=10)
    assert len(decisions) == 10
    assert client.advanced == 10
    assert client.applied_phases == [d.applied_phase for d in decisions]


def test_controller_writes_one_jsonl_record_per_tick(thresholds, tmp_path):
    log_path = tmp_path / "decisions.jsonl"
    controller = Controller(thresholds, dt=1.0, model=None, decision_log_path=log_path)
    client = FakeSumoClient(num_ticks=5)
    controller.run(client, scenario_id="fake-scenario", num_ticks=5)

    lines = log_path.read_text().strip().splitlines()
    assert len(lines) == 5
    record = json.loads(lines[0])
    assert record["state"]["scenarioId"] == "fake-scenario"
    assert record["decision"]["appliedPhase"] == "NORTH_GREEN"


def test_controller_history_window_bounded_by_sequence_length(thresholds):
    model = AlwaysRecommend("NORTH_GREEN")
    controller = Controller(thresholds, dt=1.0, model=model, sequence_length=3)
    for t in range(10):
        controller.step(make_traffic_state(tick=t))
    assert len(controller._history) == 3
