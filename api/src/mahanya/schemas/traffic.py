"""Traffic-state, model-output, and scheduler-decision data contracts.

Every field uses a camelCase JSON alias (via ``alias_generator``) so the
wire format matches ``web/src/lib/types.ts`` byte-for-byte; FastAPI's
default ``response_model_by_alias=True`` emits the alias automatically.
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

T = TypeVar("T")

ApproachDirection = Literal["north", "south", "east", "west"]

#: Single-ring, one-approach-at-a-time phase space for a simple 4-leg
#: junction: each direction's green and yellow, plus one shared all-red
#: clearance state. Documented default assumption (see ARCHITECTURE.md
#: "Data contracts") pending confirmation against the surveyed Sapon
#: Under-bridge Junction geometry.
Phase = Literal[
    "NORTH_GREEN",
    "NORTH_YELLOW",
    "SOUTH_GREEN",
    "SOUTH_YELLOW",
    "EAST_GREEN",
    "EAST_YELLOW",
    "WEST_GREEN",
    "WEST_YELLOW",
    "ALL_RED",
]

ALL_PHASES: tuple[Phase, ...] = (
    "NORTH_GREEN",
    "NORTH_YELLOW",
    "SOUTH_GREEN",
    "SOUTH_YELLOW",
    "EAST_GREEN",
    "EAST_YELLOW",
    "WEST_GREEN",
    "WEST_YELLOW",
    "ALL_RED",
)

#: The phases the model may recommend and the scheduler may target as a
#: "next green" — yellow/all-red are deterministic transition states the
#: scheduler inserts itself, never a model or scheduler *target*.
GREEN_PHASES: tuple[Phase, ...] = (
    "NORTH_GREEN",
    "SOUTH_GREEN",
    "EAST_GREEN",
    "WEST_GREEN",
)

ReasonCode = Literal[
    "model_accepted",
    "min_green_hold",
    "max_green_force",
    "anti_starvation_force",
    "emergency_preempt",
]

ScenarioStatus = Literal["idle", "running", "paused", "completed"]

ControllerKind = Literal["intelligent", "fixed-time"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TrafficDirection(CamelModel, Generic[T]):
    """A value held independently per junction approach."""

    north: T
    south: T
    east: T
    west: T

    def items(self) -> list[tuple[ApproachDirection, T]]:
        return [
            ("north", self.north),
            ("south", self.south),
            ("east", self.east),
            ("west", self.west),
        ]

    def get(self, direction: ApproachDirection) -> T:
        return getattr(self, direction)  # type: ignore[no-any-return]


class ApproachState(CamelModel):
    """Observed state of a single approach at one control-loop tick."""

    vehicle_count: int = Field(ge=0)
    queue_length: int = Field(ge=0)
    waiting_time_sec: float = Field(ge=0)
    has_emergency_vehicle: bool = False


class VehiclePosition(CamelModel):
    """One vehicle's live position, for rendering on the junction view."""

    vehicle_id: str
    x: float
    y: float
    angle_deg: float = Field(ge=0, le=360)
    is_emergency: bool = False


class TrafficState(CamelModel):
    """A single observed traffic-state snapshot for one junction tick."""

    scenario_id: str
    tick: int = Field(ge=0)
    timestamp: datetime
    approaches: TrafficDirection[ApproachState]
    active_phase: Phase
    elapsed_phase_time_sec: float = Field(ge=0)
    #: Live per-vehicle positions network-wide, for the junction visualization.
    #: Empty for callers that don't need it (e.g. training-sequence generation).
    vehicles: list[VehiclePosition] = Field(default_factory=list)


class PhaseRecommendation(CamelModel):
    """The transformer's advisory output. Never applied directly."""

    recommended_phase: Phase
    confidence: float = Field(ge=0, le=1)
    phase_scores: dict[Phase, float] | None = None


class SchedulerDecision(CamelModel):
    """The scheduler's final, applied decision for one control-loop tick.

    ``recommendation`` is ``None`` when the model wasn't consulted this
    tick — either an emergency pre-emption short-circuit, or a model
    inference failure the scheduler safely fell back around.
    """

    tick: int = Field(ge=0)
    timestamp: datetime
    recommendation: PhaseRecommendation | None
    applied_phase: Phase
    reason_code: ReasonCode
    reason_detail: str | None = None


class DecisionLogRecord(CamelModel):
    """One JSON-lines record appended per control-loop tick."""

    state: TrafficState
    decision: SchedulerDecision


class EvaluationMetrics(CamelModel):
    """Aggregate metrics for one controller over one scenario run."""

    controller: ControllerKind
    scenario_id: str
    avg_waiting_time_sec: float = Field(ge=0)
    avg_queue_length: float = Field(ge=0)
    throughput_veh_per_hour: float = Field(ge=0)
    priority_response_time_sec: float = Field(ge=0)


class Scenario(CamelModel):
    """A discoverable, runnable SUMO scenario."""

    id: str
    name: str
    status: ScenarioStatus
    seed: int
