"""Synthetic `TrafficState` builders, so scheduler/model tests never depend
on a running SUMO instance (see ARCHITECTURE.md's testing strategy).
"""

from __future__ import annotations

from datetime import UTC, datetime

from mahanya.schemas import ApproachDirection, ApproachState, Phase, TrafficDirection, TrafficState

BASE_TIME = datetime(2026, 3, 3, 7, 30, tzinfo=UTC)


def make_approach(
    vehicle_count: int = 0,
    queue_length: int = 0,
    waiting_time_sec: float = 0.0,
    has_emergency_vehicle: bool = False,
) -> ApproachState:
    return ApproachState(
        vehicle_count=vehicle_count,
        queue_length=queue_length,
        waiting_time_sec=waiting_time_sec,
        has_emergency_vehicle=has_emergency_vehicle,
    )


def make_traffic_state(
    tick: int = 0,
    active_phase: Phase = "NORTH_GREEN",
    elapsed_phase_time_sec: float = 0.0,
    scenario_id: str = "test-scenario",
    emergency_direction: ApproachDirection | None = None,
    **approach_overrides: ApproachState,
) -> TrafficState:
    approaches = {
        direction: approach_overrides.get(direction, make_approach())
        for direction in ("north", "south", "east", "west")
    }
    if emergency_direction is not None:
        approaches[emergency_direction] = make_approach(has_emergency_vehicle=True)

    return TrafficState(
        scenario_id=scenario_id,
        tick=tick,
        timestamp=BASE_TIME,
        approaches=TrafficDirection(**approaches),
        active_phase=active_phase,
        elapsed_phase_time_sec=elapsed_phase_time_sec,
    )
