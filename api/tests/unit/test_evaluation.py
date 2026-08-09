"""Tests for `evaluation.baseline` (fixed-time controller) and
`evaluation.metrics` (MetricsCollector, run_scenario).
"""

from __future__ import annotations

import pytest

from mahanya.evaluation.baseline import CYCLE_ORDER, FixedTimeController
from mahanya.evaluation.metrics import MetricsCollector, run_scenario
from mahanya.schemas import ApproachDirection, Phase, TrafficState
from tests.fixtures.traffic import make_approach, make_traffic_state


class TestFixedTimeController:
    def test_holds_green_for_exactly_green_sec(self):
        controller = FixedTimeController(green_sec=5.0, yellow_sec=3.0, all_red_sec=2.0)
        phases = [controller.step(1.0) for _ in range(4)]
        assert phases == ["NORTH_GREEN"] * 4
        assert controller.step(1.0) == "NORTH_YELLOW"

    def test_cycles_through_all_directions_in_order(self):
        controller = FixedTimeController(green_sec=2.0, yellow_sec=1.0, all_red_sec=1.0)
        seen: list[Phase] = []
        for _ in range(40):
            phase = controller.step(1.0)
            if phase not in seen:
                seen.append(phase)
        for green_phase in CYCLE_ORDER:
            assert green_phase in seen

    def test_never_adapts_to_traffic(self):
        """The point of the baseline: it takes no traffic-state input at all."""

        controller = FixedTimeController(green_sec=5.0, yellow_sec=3.0, all_red_sec=2.0)
        import inspect

        assert list(inspect.signature(controller.step).parameters) == ["dt"]


class FakeMetricsClient:
    """Keys everything off its own internal tick counter (advanced only by
    `advance()`), so emergency-sighting and arrival timing are unambiguous
    regardless of the driving loop's own tick variable."""

    def __init__(self, emergency_tick: int, arrival_tick: int) -> None:
        self.emergency_tick = emergency_tick
        self.arrival_tick = arrival_tick
        self._tick = 0

    def observe(self, scenario_id: str, tick: int) -> TrafficState:
        emergency: ApproachDirection | None = "east" if self._tick == self.emergency_tick else None
        return make_traffic_state(
            tick=self._tick,
            scenario_id=scenario_id,
            east=make_approach(queue_length=2, waiting_time_sec=10.0),
            emergency_direction=emergency,
        )

    def apply(self, phase: Phase) -> None:
        pass

    def advance(self) -> None:
        self._tick += 1

    def arrived_vehicle_ids(self) -> list[str]:
        return ["emergency-veh"] if self._tick == self.arrival_tick else []

    def emergency_vehicle_ids_present(self) -> list[str]:
        return ["emergency-veh"] if self._tick == self.emergency_tick else []


def test_metrics_collector_averages_observed_state():
    collector = MetricsCollector(controller="intelligent", scenario_id="s")
    collector.observe_state(
        make_traffic_state(east=make_approach(queue_length=4, waiting_time_sec=20.0)), dt=1.0
    )
    collector.observe_state(
        make_traffic_state(east=make_approach(queue_length=0, waiting_time_sec=0.0)), dt=1.0
    )
    metrics = collector.finalize()
    assert metrics.avg_queue_length == 0.5  # (4+0+0+0+0+0+0+0) / 8 samples
    assert metrics.avg_waiting_time_sec == 2.5


def test_metrics_collector_priority_response_time():
    collector = MetricsCollector(controller="intelligent", scenario_id="s")
    collector.record_emergency_present(["veh-1"])
    collector._elapsed_sec = 10.0
    collector.record_departures(["veh-1"])
    metrics = collector.finalize()
    assert metrics.priority_response_time_sec == 10.0


def test_run_scenario_end_to_end_with_fake_client():
    # Emergency first sighted when the client's internal tick hits 2 (at
    # elapsed_sec=3.0, since observe_state runs before the sighting is
    # recorded); it "arrives" when the internal tick hits 5 (elapsed_sec
    # already at 5.0 by then) -> a 2.0s response time.
    client = FakeMetricsClient(emergency_tick=2, arrival_tick=5)
    collector = MetricsCollector(controller="fixed-time", scenario_id="fake")

    def decide(_traffic: TrafficState) -> Phase:
        return "EAST_GREEN"

    metrics = run_scenario(client, "fake", num_ticks=10, dt=1.0, decide=decide, collector=collector)
    assert metrics.controller == "fixed-time"
    assert metrics.throughput_veh_per_hour == pytest.approx(1 / (10 / 3600))
    assert metrics.priority_response_time_sec == pytest.approx(2.0)
