"""Standard traffic-engineering metrics computed from a live scenario run:
average waiting time, queue length, throughput, and priority (emergency)
vehicle response time.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from statistics import mean
from typing import Protocol

from mahanya.scheduler.controller import SumoClient
from mahanya.schemas import ControllerKind, EvaluationMetrics, Phase, TrafficState


@dataclass(slots=True)
class MetricsCollector:
    controller: ControllerKind
    scenario_id: str
    _waiting_time_samples: list[float] = field(default_factory=list)
    _queue_length_samples: list[float] = field(default_factory=list)
    _arrived_count: int = 0
    _elapsed_sec: float = 0.0
    _emergency_first_seen: dict[str, float] = field(default_factory=dict)
    _priority_response_times: list[float] = field(default_factory=list)

    def observe_state(self, state: TrafficState, dt: float) -> None:
        for _, approach in state.approaches.items():
            self._waiting_time_samples.append(approach.waiting_time_sec)
            self._queue_length_samples.append(float(approach.queue_length))
        self._elapsed_sec += dt

    def record_arrivals(self, count: int) -> None:
        self._arrived_count += count

    def record_emergency_present(self, vehicle_ids: list[str]) -> None:
        for vehicle_id in vehicle_ids:
            self._emergency_first_seen.setdefault(vehicle_id, self._elapsed_sec)

    def record_departures(self, vehicle_ids: list[str]) -> None:
        for vehicle_id in vehicle_ids:
            first_seen = self._emergency_first_seen.pop(vehicle_id, None)
            if first_seen is not None:
                self._priority_response_times.append(self._elapsed_sec - first_seen)

    def finalize(self) -> EvaluationMetrics:
        duration_hours = self._elapsed_sec / 3600.0
        avg_waiting = mean(self._waiting_time_samples) if self._waiting_time_samples else 0.0
        avg_queue = mean(self._queue_length_samples) if self._queue_length_samples else 0.0
        throughput = self._arrived_count / duration_hours if duration_hours > 0 else 0.0
        priority_response = (
            mean(self._priority_response_times) if self._priority_response_times else 0.0
        )
        return EvaluationMetrics(
            controller=self.controller,
            scenario_id=self.scenario_id,
            avg_waiting_time_sec=avg_waiting,
            avg_queue_length=avg_queue,
            throughput_veh_per_hour=throughput,
            priority_response_time_sec=priority_response,
        )


class MetricsAwareClient(SumoClient, Protocol):
    """Any object satisfying `SumoClient` plus these two extra hooks (as
    `mahanya.sumo.TraciClient` does) can drive `run_scenario`."""

    def arrived_vehicle_ids(self) -> list[str]: ...  # pragma: no cover - protocol doc only

    def emergency_vehicle_ids_present(self) -> list[str]: ...  # pragma: no cover


def run_scenario(
    client: MetricsAwareClient,
    scenario_id: str,
    num_ticks: int,
    dt: float,
    decide: Callable[[TrafficState], Phase],
    collector: MetricsCollector,
) -> EvaluationMetrics:
    """Drive `client` for `num_ticks`, applying `decide(traffic)` each tick
    and feeding `collector`. Works for both the intelligent controller
    (`decide` wraps `Controller.step`) and `FixedTimeController`."""

    for t in range(num_ticks):
        traffic = client.observe(scenario_id, t)
        collector.observe_state(traffic, dt)
        collector.record_emergency_present(client.emergency_vehicle_ids_present())

        phase = decide(traffic)
        client.apply(phase)
        client.advance()

        arrived = client.arrived_vehicle_ids()
        collector.record_arrivals(len(arrived))
        collector.record_departures(arrived)

    return collector.finalize()
