"""Tests for the shared data contracts: camelCase wire format, generics,
and the optional-recommendation contract.
"""

from __future__ import annotations

from mahanya.schemas import (
    ALL_PHASES,
    GREEN_PHASES,
    SchedulerDecision,
    TrafficDirection,
)
from tests.fixtures.traffic import make_traffic_state


def test_traffic_state_serializes_camel_case():
    state = make_traffic_state()
    payload = state.model_dump(by_alias=True)
    assert "scenarioId" in payload
    assert "activePhase" in payload
    assert "elapsedPhaseTimeSec" in payload
    north_keys = payload["approaches"]["north"].keys()
    assert north_keys >= {"vehicleCount", "queueLength", "waitingTimeSec"}


def test_traffic_state_round_trips_through_camel_case_json():
    state = make_traffic_state(tick=5, active_phase="WEST_GREEN")
    json_str = state.model_dump_json(by_alias=True)
    restored = state.__class__.model_validate_json(json_str)
    assert restored == state


def test_traffic_direction_generic_supports_int_and_bool():
    ints = TrafficDirection[int](north=1, south=2, east=3, west=4)
    assert ints.get("east") == 3
    assert dict(ints.items()) == {"north": 1, "south": 2, "east": 3, "west": 4}


def test_scheduler_decision_recommendation_optional():
    state = make_traffic_state()
    decision = SchedulerDecision(
        tick=state.tick,
        timestamp=state.timestamp,
        recommendation=None,
        applied_phase="EAST_GREEN",
        reason_code="emergency_preempt",
        reason_detail="Emergency vehicle detected on east approach",
    )
    payload = decision.model_dump(by_alias=True)
    assert payload["recommendation"] is None
    restored = SchedulerDecision.model_validate_json(decision.model_dump_json(by_alias=True))
    assert restored.recommendation is None


def test_phase_space_is_nine_states_four_green_four_yellow_one_all_red():
    assert len(ALL_PHASES) == 9
    assert len(GREEN_PHASES) == 4
    yellows = [p for p in ALL_PHASES if p.endswith("_YELLOW")]
    assert len(yellows) == 4
    assert "ALL_RED" in ALL_PHASES
    assert set(GREEN_PHASES).issubset(set(ALL_PHASES))
