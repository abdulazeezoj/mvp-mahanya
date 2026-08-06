"""Deterministic scheduler rules: min/max green, transitions, anti-starvation,
emergency pre-emption.

These are pure functions over an explicit :class:`ControllerState` — no I/O,
no SUMO, no model. This is the safety-critical layer: every decision that
overrides or holds the model's recommendation is returned with an explicit
:data:`~mahanya.schemas.ReasonCode`, and hard safety constraints (minimum
green, transition intervals, no conflicting simultaneous greens) are
structurally impossible to violate because the state machine only ever
exposes a single active :class:`~mahanya.schemas.Phase` at a time and only
advances it one legal step per tick.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace

from mahanya.config import SchedulerThresholds
from mahanya.schemas import (
    GREEN_PHASES,
    ApproachDirection,
    Phase,
    PhaseRecommendation,
    ReasonCode,
    SchedulerDecision,
    TrafficState,
)

#: Fixed, deterministic tie-break order used whenever multiple directions
#: are equally eligible (e.g. simultaneous emergencies, equal wait times).
DIRECTION_ORDER: tuple[ApproachDirection, ...] = ("north", "south", "east", "west")

DIRECTION_TO_GREEN: dict[ApproachDirection, Phase] = {
    "north": "NORTH_GREEN",
    "south": "SOUTH_GREEN",
    "east": "EAST_GREEN",
    "west": "WEST_GREEN",
}
GREEN_TO_DIRECTION: dict[Phase, ApproachDirection] = {v: k for k, v in DIRECTION_TO_GREEN.items()}
GREEN_TO_YELLOW: dict[Phase, Phase] = {
    "NORTH_GREEN": "NORTH_YELLOW",
    "SOUTH_GREEN": "SOUTH_YELLOW",
    "EAST_GREEN": "EAST_YELLOW",
    "WEST_GREEN": "WEST_YELLOW",
}
YELLOW_TO_DIRECTION: dict[Phase, ApproachDirection] = {
    "NORTH_YELLOW": "north",
    "SOUTH_YELLOW": "south",
    "EAST_YELLOW": "east",
    "WEST_YELLOW": "west",
}
TRANSITION_PHASES: frozenset[Phase] = frozenset(
    {"NORTH_YELLOW", "SOUTH_YELLOW", "EAST_YELLOW", "WEST_YELLOW", "ALL_RED"}
)


@dataclass(frozen=True, slots=True)
class ControllerState:
    """Internal scheduler state, threaded through :func:`tick` call-by-call."""

    current_phase: Phase = "NORTH_GREEN"
    phase_elapsed_sec: float = 0.0
    #: The green phase already active, or being transitioned toward.
    target_green: Phase = "NORTH_GREEN"
    direction_wait_sec: dict[ApproachDirection, float] = field(
        default_factory=lambda: {d: 0.0 for d in DIRECTION_ORDER}
    )
    #: Why the in-flight transition (if any) was initiated; carried across
    #: every tick of the yellow/all-red sequence so the reason reported in
    #: the decision log reflects the actual trigger, not a re-derived guess.
    pending_reason: ReasonCode = "model_accepted"
    pending_detail: str | None = None


def initial_state(start_phase: Phase = "NORTH_GREEN") -> ControllerState:
    if start_phase not in GREEN_PHASES:
        raise ValueError(f"start_phase must be a green phase, got {start_phase!r}")
    return ControllerState(current_phase=start_phase, target_green=start_phase)


def detect_emergency(traffic: TrafficState) -> ApproachDirection | None:
    for direction in DIRECTION_ORDER:
        if traffic.approaches.get(direction).has_emergency_vehicle:
            return direction
    return None


def _most_starved_direction(
    direction_wait_sec: dict[ApproachDirection, float],
    exclude: ApproachDirection,
) -> ApproachDirection:
    candidates = [d for d in DIRECTION_ORDER if d != exclude]
    return max(candidates, key=lambda d: (direction_wait_sec[d], DIRECTION_ORDER.index(d) * -1))


def _advance_wait_clock(state: ControllerState, dt: float) -> dict[ApproachDirection, float]:
    flowing = GREEN_TO_DIRECTION.get(state.current_phase) or YELLOW_TO_DIRECTION.get(
        state.current_phase
    )
    updated = dict(state.direction_wait_sec)
    for direction in DIRECTION_ORDER:
        if direction == flowing:
            updated[direction] = 0.0
        else:
            updated[direction] = updated[direction] + dt
    return updated


def _decide_target(
    state: ControllerState,
    traffic: TrafficState,
    recommendation: PhaseRecommendation | None,
    thresholds: SchedulerThresholds,
    emergency_direction: ApproachDirection | None,
) -> tuple[Phase, ReasonCode, str | None]:
    """Choose the desired green phase and why, ignoring minimum-green gating."""

    current_direction = GREEN_TO_DIRECTION[state.current_phase]

    if emergency_direction is not None and emergency_direction != current_direction:
        target = DIRECTION_TO_GREEN[emergency_direction]
        return (
            target,
            "emergency_preempt",
            (f"Emergency vehicle detected on {emergency_direction} approach"),
        )

    if emergency_direction is not None and emergency_direction == current_direction:
        return (
            state.current_phase,
            "emergency_preempt",
            (f"Holding green for detected emergency vehicle on {current_direction} approach"),
        )

    if state.phase_elapsed_sec >= thresholds.max_green_sec:
        target_direction = _most_starved_direction(state.direction_wait_sec, current_direction)
        return (
            DIRECTION_TO_GREEN[target_direction],
            "max_green_force",
            (
                f"{state.current_phase} reached maximum green duration "
                f"({thresholds.max_green_sec:.0f}s)"
            ),
        )

    starved = [
        d
        for d in DIRECTION_ORDER
        if d != current_direction
        and state.direction_wait_sec[d] > thresholds.anti_starvation_wait_sec
    ]
    if starved:
        target_direction = _most_starved_direction(state.direction_wait_sec, current_direction)
        return (
            DIRECTION_TO_GREEN[target_direction],
            "anti_starvation_force",
            (
                f"{target_direction} approach exceeded max wait threshold "
                f"({thresholds.anti_starvation_wait_sec:.0f}s)"
            ),
        )

    if (
        recommendation is not None
        and recommendation.recommended_phase in GREEN_PHASES
        and recommendation.recommended_phase != state.current_phase
    ):
        return recommendation.recommended_phase, "model_accepted", None

    return state.current_phase, "model_accepted", None


def tick(
    state: ControllerState,
    traffic: TrafficState,
    recommendation: PhaseRecommendation | None,
    thresholds: SchedulerThresholds,
    dt: float,
) -> tuple[ControllerState, SchedulerDecision]:
    """Advance the scheduler by one control-loop tick.

    Pure function: same inputs always produce the same
    ``(new_state, decision)`` pair.
    """

    direction_wait_sec = _advance_wait_clock(state, dt)
    phase_elapsed_sec = state.phase_elapsed_sec + dt
    working = replace(
        state, phase_elapsed_sec=phase_elapsed_sec, direction_wait_sec=direction_wait_sec
    )

    if working.current_phase in TRANSITION_PHASES:
        return _advance_transition(working, recommendation, thresholds, traffic)

    emergency_direction = detect_emergency(traffic)
    target, reason_code, reason_detail = _decide_target(
        working, traffic, recommendation, thresholds, emergency_direction
    )

    if target == working.current_phase:
        new_state = replace(working, target_green=target)
        decision = SchedulerDecision(
            tick=traffic.tick,
            timestamp=traffic.timestamp,
            recommendation=recommendation,
            applied_phase=new_state.current_phase,
            reason_code=reason_code,
            reason_detail=reason_detail,
        )
        return new_state, decision

    if working.phase_elapsed_sec < thresholds.min_green_sec:
        remaining = thresholds.min_green_sec - working.phase_elapsed_sec
        decision = SchedulerDecision(
            tick=traffic.tick,
            timestamp=traffic.timestamp,
            recommendation=recommendation,
            applied_phase=working.current_phase,
            reason_code="min_green_hold",
            reason_detail=(
                f"{working.current_phase} has {remaining:.0f}s remaining "
                "before minimum green elapses"
            ),
        )
        return working, decision

    next_phase = GREEN_TO_YELLOW[working.current_phase]
    new_state = replace(
        working,
        current_phase=next_phase,
        phase_elapsed_sec=0.0,
        target_green=target,
        pending_reason=reason_code,
        pending_detail=reason_detail,
    )
    decision = SchedulerDecision(
        tick=traffic.tick,
        timestamp=traffic.timestamp,
        recommendation=recommendation,
        applied_phase=next_phase,
        reason_code=reason_code,
        reason_detail=reason_detail,
    )
    return new_state, decision


def _advance_transition(
    working: ControllerState,
    recommendation: PhaseRecommendation | None,
    thresholds: SchedulerThresholds,
    traffic: TrafficState,
) -> tuple[ControllerState, SchedulerDecision]:
    in_yellow = working.current_phase in YELLOW_TO_DIRECTION
    required = thresholds.yellow_sec if in_yellow else thresholds.all_red_sec

    if working.phase_elapsed_sec < required:
        new_state = working
    elif working.current_phase in YELLOW_TO_DIRECTION:
        new_state = replace(working, current_phase="ALL_RED", phase_elapsed_sec=0.0)
    else:
        new_state = replace(
            working,
            current_phase=working.target_green,
            phase_elapsed_sec=0.0,
        )

    decision = SchedulerDecision(
        tick=traffic.tick,
        timestamp=traffic.timestamp,
        recommendation=recommendation,
        applied_phase=new_state.current_phase,
        reason_code=working.pending_reason,
        reason_detail=working.pending_detail,
    )
    return new_state, decision
