"""A fixed-time baseline controller: round-robin phases on a fixed schedule,
with no adaptation, no anti-starvation, and no emergency pre-emption: the
status-quo behaviour described in PRODUCT_SPEC.md's problem statement, used
as the evaluation control group the intelligent controller must beat.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from mahanya.scheduler.rules import GREEN_TO_YELLOW, YELLOW_TO_DIRECTION
from mahanya.schemas import GREEN_PHASES, Phase

#: Round-robin order; GREEN_PHASES is already (north, south, east, west).
CYCLE_ORDER: tuple[Phase, ...] = GREEN_PHASES


@dataclass(frozen=True, slots=True)
class FixedTimeState:
    current_phase: Phase = "NORTH_GREEN"
    phase_elapsed_sec: float = 0.0
    cycle_index: int = 0


class FixedTimeController:
    """Cycles NORTH -> SOUTH -> EAST -> WEST on fixed green/yellow/all-red
    durations, forever, regardless of observed traffic."""

    def __init__(self, green_sec: float, yellow_sec: float, all_red_sec: float) -> None:
        self._green_sec = green_sec
        self._yellow_sec = yellow_sec
        self._all_red_sec = all_red_sec
        self._state = FixedTimeState()

    @property
    def state(self) -> FixedTimeState:
        return self._state

    def step(self, dt: float) -> Phase:
        """Advance by one tick; returns the phase to apply this tick."""

        working = replace(self._state, phase_elapsed_sec=self._state.phase_elapsed_sec + dt)

        if working.current_phase in YELLOW_TO_DIRECTION:
            if working.phase_elapsed_sec >= self._yellow_sec:
                working = replace(working, current_phase="ALL_RED", phase_elapsed_sec=0.0)
        elif working.current_phase == "ALL_RED":
            if working.phase_elapsed_sec >= self._all_red_sec:
                next_index = (working.cycle_index + 1) % len(CYCLE_ORDER)
                working = FixedTimeState(
                    current_phase=CYCLE_ORDER[next_index],
                    phase_elapsed_sec=0.0,
                    cycle_index=next_index,
                )
        else:  # a green phase
            if working.phase_elapsed_sec >= self._green_sec:
                next_phase = GREEN_TO_YELLOW[working.current_phase]
                working = replace(working, current_phase=next_phase, phase_elapsed_sec=0.0)

        self._state = working
        return working.current_phase
