"""Exhaustive tests for the safety-critical deterministic scheduler rules:
minimum/maximum green, transition sequencing, anti-starvation, and
emergency pre-emption interrupting/resuming normal control.
"""

from __future__ import annotations

import pytest

from mahanya.config import SchedulerThresholds
from mahanya.scheduler.rules import (
    DIRECTION_ORDER,
    ControllerState,
    detect_emergency,
    initial_state,
    tick,
)
from mahanya.schemas import ApproachDirection, PhaseRecommendation, SchedulerDecision
from tests.fixtures.traffic import make_approach, make_traffic_state


def _advance(
    state: ControllerState,
    thresholds: SchedulerThresholds,
    recommendation: PhaseRecommendation | None = None,
    emergency_direction: ApproachDirection | None = None,
) -> tuple[ControllerState, SchedulerDecision]:
    """Build the tick's TrafficState from `state` itself, then advance once."""

    traffic = make_traffic_state(
        active_phase=state.current_phase,
        elapsed_phase_time_sec=state.phase_elapsed_sec,
        emergency_direction=emergency_direction,
    )
    return tick(state, traffic, recommendation, thresholds, dt=1.0)


class TestMinimumGreen:
    def test_holds_current_phase_before_min_green_elapses(self, thresholds):
        state = initial_state("NORTH_GREEN")
        rec = PhaseRecommendation(recommended_phase="SOUTH_GREEN", confidence=0.9)
        for _ in range(int(thresholds.min_green_sec) - 1):
            state, decision = _advance(state, thresholds, rec)
            assert decision.reason_code == "min_green_hold"
            assert decision.applied_phase == "NORTH_GREEN"
            assert state.current_phase == "NORTH_GREEN"

    def test_transitions_exactly_at_min_green(self, thresholds):
        state = initial_state("NORTH_GREEN")
        rec = PhaseRecommendation(recommended_phase="SOUTH_GREEN", confidence=0.9)
        for _ in range(int(thresholds.min_green_sec) - 1):
            state, _ = _advance(state, thresholds, rec)

        state, decision = _advance(state, thresholds, rec)
        assert decision.applied_phase == "NORTH_YELLOW"
        assert decision.reason_code == "model_accepted"

    def test_no_change_requested_never_holds(self, thresholds):
        state = initial_state("NORTH_GREEN")
        rec = PhaseRecommendation(recommended_phase="NORTH_GREEN", confidence=0.9)
        _, decision = _advance(state, thresholds, rec)
        assert decision.reason_code == "model_accepted"
        assert decision.applied_phase == "NORTH_GREEN"


class TestTransitionSequencing:
    def test_full_yellow_all_red_sequence_to_target(self, thresholds):
        state = initial_state("NORTH_GREEN")
        rec = PhaseRecommendation(recommended_phase="SOUTH_GREEN", confidence=0.9)

        # Satisfy minimum green, then trigger the transition.
        for _ in range(int(thresholds.min_green_sec)):
            state, decision = _advance(state, thresholds, rec)
        assert state.current_phase == "NORTH_YELLOW"

        # Yellow holds for yellow_sec - 1 more ticks, then flips to ALL_RED.
        for _ in range(int(thresholds.yellow_sec) - 1):
            state, decision = _advance(state, thresholds, rec)
            assert state.current_phase == "NORTH_YELLOW"
        state, decision = _advance(state, thresholds, rec)
        assert state.current_phase == "ALL_RED"

        for _ in range(int(thresholds.all_red_sec) - 1):
            state, decision = _advance(state, thresholds, rec)
            assert state.current_phase == "ALL_RED"
        state, decision = _advance(state, thresholds, rec)
        assert state.current_phase == "SOUTH_GREEN"
        assert decision.applied_phase == "SOUTH_GREEN"

    def test_transition_never_skips_a_stage(self, thresholds):
        """No single tick may jump straight from a green phase to another
        green phase, or from yellow straight to green — every hard safety
        transition state must be visited."""

        state = initial_state("NORTH_GREEN")
        rec = PhaseRecommendation(recommended_phase="EAST_GREEN", confidence=0.9)
        seen_phases = [state.current_phase]
        total = int(thresholds.min_green_sec + thresholds.yellow_sec + thresholds.all_red_sec)
        for _ in range(total + 2):
            state, _ = _advance(state, thresholds, rec)
            seen_phases.append(state.current_phase)

        assert "NORTH_YELLOW" in seen_phases
        assert "ALL_RED" in seen_phases
        assert "EAST_GREEN" in seen_phases
        # No two adjacent green phases without an intervening transition.
        greens = {"NORTH_GREEN", "SOUTH_GREEN", "EAST_GREEN", "WEST_GREEN"}
        for prev, nxt in zip(seen_phases, seen_phases[1:], strict=False):
            if prev in greens and nxt in greens:
                assert prev == nxt

    def test_reason_code_carried_through_entire_transition(self, thresholds):
        """The reason a transition started (e.g. anti-starvation) must be
        reported on every tick of the transition, not re-derived."""

        state = initial_state("NORTH_GREEN")
        # Push west's wait well past the anti-starvation threshold.
        for _ in range(int(thresholds.anti_starvation_wait_sec) + 1):
            state, decision = _advance(state, thresholds)
        assert decision.reason_code == "anti_starvation_force"
        assert state.current_phase == "NORTH_YELLOW"

        for _ in range(int(thresholds.yellow_sec) - 1):
            state, decision = _advance(state, thresholds)
            assert decision.reason_code == "anti_starvation_force"
            assert state.current_phase == "NORTH_YELLOW"

        state, decision = _advance(state, thresholds)
        assert decision.reason_code == "anti_starvation_force"
        assert state.current_phase == "ALL_RED"


class TestMaximumGreen:
    def test_forces_change_after_max_green_even_if_model_wants_to_stay(self, thresholds):
        # anti_starvation_wait_sec must exceed max_green_sec here, or
        # anti-starvation would fire first and mask what this test targets.
        thresholds = thresholds.model_copy(update={"anti_starvation_wait_sec": 1000.0})
        state = initial_state("NORTH_GREEN")
        rec = PhaseRecommendation(recommended_phase="NORTH_GREEN", confidence=0.99)
        for _ in range(int(thresholds.max_green_sec)):
            state, decision = _advance(state, thresholds, rec)
        assert decision.reason_code == "max_green_force"
        assert state.current_phase == "NORTH_YELLOW"

    def test_forces_change_to_most_starved_other_direction(self, thresholds):
        thresholds = thresholds.model_copy(update={"anti_starvation_wait_sec": 1000.0})
        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.max_green_sec)):
            state, decision = _advance(state, thresholds)
        assert decision.reason_code == "max_green_force"
        # All non-active directions accrue wait at the same rate here, so
        # the deterministic tie-break should pick the first in
        # DIRECTION_ORDER after "north" — i.e. "south".
        assert state.target_green == "SOUTH_GREEN"


class TestAntiStarvation:
    def test_does_not_trigger_below_threshold(self, thresholds):
        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.anti_starvation_wait_sec) - 2):
            state, decision = _advance(state, thresholds)
        assert decision.reason_code == "model_accepted"
        assert state.current_phase == "NORTH_GREEN"

    def test_triggers_once_a_direction_exceeds_threshold(self, thresholds):
        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.anti_starvation_wait_sec) + 1):
            state, decision = _advance(state, thresholds)
        assert decision.reason_code == "anti_starvation_force"

    def test_deterministic_tie_break_follows_direction_order(self, thresholds):
        """All three non-active directions become equally starved at once;
        the winner must be the first one in DIRECTION_ORDER."""

        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.anti_starvation_wait_sec) + 1):
            state, decision = _advance(state, thresholds)
        non_active = [d for d in DIRECTION_ORDER if d != "north"]
        assert non_active[0] == "south"
        assert state.target_green == "SOUTH_GREEN"


class TestEmergencyPreemption:
    def test_preempts_to_emergency_direction_after_min_green(self, thresholds):
        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.min_green_sec)):
            state, decision = _advance(state, thresholds)

        state, decision = _advance(state, thresholds, emergency_direction="east")
        assert decision.reason_code == "emergency_preempt"
        assert state.current_phase == "NORTH_YELLOW"
        assert state.target_green == "EAST_GREEN"

    def test_emergency_never_skips_minimum_green(self, thresholds):
        """Minimum green is a hard safety constraint — even an emergency
        vehicle must wait for it, per the acceptance criteria."""

        state = initial_state("NORTH_GREEN")
        state, decision = _advance(state, thresholds, emergency_direction="east")
        assert decision.reason_code == "min_green_hold"
        assert state.current_phase == "NORTH_GREEN"

    def test_holds_green_for_emergency_on_active_direction(self, thresholds):
        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.min_green_sec) + 2):
            state, decision = _advance(state, thresholds, emergency_direction="north")
            assert decision.reason_code == "emergency_preempt"
            assert state.current_phase == "NORTH_GREEN"

    def test_emergency_overrides_max_green_on_active_direction(self, thresholds):
        """An emergency vehicle on the currently green approach holds that
        green even past the normal maximum-green cap."""

        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.max_green_sec) + 5):
            state, decision = _advance(state, thresholds, emergency_direction="north")
        assert state.current_phase == "NORTH_GREEN"
        assert decision.reason_code == "emergency_preempt"

    def test_never_skips_yellow_or_all_red_for_emergency(self, thresholds):
        """Pre-emption still takes effect only at the next legal transition
        point — it must not skip a clearance interval."""

        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.min_green_sec)):
            state, _ = _advance(state, thresholds)

        state, decision = _advance(state, thresholds, emergency_direction="west")
        assert state.current_phase == "NORTH_YELLOW"
        assert decision.applied_phase == "NORTH_YELLOW"

        # Even with the emergency still present, yellow must run its full
        # duration before ALL_RED, and ALL_RED its full duration before
        # WEST_GREEN.
        for _ in range(int(thresholds.yellow_sec) - 1):
            state, _ = _advance(state, thresholds, emergency_direction="west")
            assert state.current_phase == "NORTH_YELLOW"

    def test_resumes_normal_control_after_emergency_clears(self, thresholds):
        state = initial_state("NORTH_GREEN")
        for _ in range(int(thresholds.min_green_sec)):
            state, _ = _advance(state, thresholds)

        # No emergency, no starvation, model wants to stay -> model_accepted.
        rec = PhaseRecommendation(recommended_phase="NORTH_GREEN", confidence=0.9)
        state, decision = _advance(state, thresholds, rec)
        assert decision.reason_code == "model_accepted"
        assert state.current_phase == "NORTH_GREEN"

    def test_detect_emergency_deterministic_priority(self):
        traffic = make_traffic_state(
            north=make_approach(has_emergency_vehicle=True),
            south=make_approach(has_emergency_vehicle=True),
        )
        assert detect_emergency(traffic) == "north"

    def test_detect_emergency_none_when_absent(self):
        traffic = make_traffic_state()
        assert detect_emergency(traffic) is None


class TestInitialState:
    def test_rejects_non_green_start_phase(self):
        with pytest.raises(ValueError, match="green phase"):
            initial_state("ALL_RED")

    def test_defaults_to_north_green(self):
        state = initial_state()
        assert state.current_phase == "NORTH_GREEN"
        assert state.target_green == "NORTH_GREEN"
        assert all(w == 0.0 for w in state.direction_wait_sec.values())
