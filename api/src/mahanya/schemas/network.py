"""Static junction geometry and live vehicle-position contracts.

Separate from ``traffic.py``'s per-tick aggregate contracts: this module
covers the physical road layout (fixed for a scenario's lifetime) and raw
per-vehicle positions, both consumed by the dashboard's live junction
visualization.
"""

from __future__ import annotations

from typing import Literal

from mahanya.schemas.traffic import ApproachDirection, CamelModel

LaneKind = Literal["in", "out"]


class LaneGeometry(CamelModel):
    """One lane's centerline, in the same coordinate space as `VehiclePosition`."""

    id: str
    edge_id: str
    direction: ApproachDirection
    kind: LaneKind
    shape: list[tuple[float, float]]


class NetworkBounds(CamelModel):
    min_x: float
    min_y: float
    max_x: float
    max_y: float


class NetworkGeometry(CamelModel):
    """The static road layout a scenario's vehicles move through."""

    bounds: NetworkBounds
    lanes: list[LaneGeometry]
