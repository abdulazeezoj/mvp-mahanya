"""Static junction road geometry, parsed directly from a compiled `.net.xml`.

Kept separate from TraCI entirely — this only reads the checked-in network
file, so it works without a running SUMO process and never changes for the
lifetime of a scenario.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from mahanya.schemas import ApproachDirection, LaneGeometry, NetworkBounds, NetworkGeometry

_DIRECTIONS: tuple[ApproachDirection, ...] = ("north", "south", "east", "west")


def _direction_for_edge(edge_id: str) -> ApproachDirection | None:
    for direction in _DIRECTIONS:
        if edge_id.startswith(direction):
            return direction
    return None


def _parse_shape(shape: str) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for pair in shape.split():
        x_str, y_str = pair.split(",")
        points.append((float(x_str), float(y_str)))
    return points


def load_network_geometry(net_file: Path) -> NetworkGeometry:
    root = ET.parse(net_file).getroot()
    location = root.find("location")
    bounds_attr = location.get("convBoundary") if location is not None else None
    if not bounds_attr:
        raise ValueError(f"no <location convBoundary=...> found in {net_file}")
    min_x, min_y, max_x, max_y = (float(v) for v in bounds_attr.split(","))

    lanes: list[LaneGeometry] = []
    for edge in root.findall("edge"):
        edge_id = edge.get("id") or ""
        if edge_id.startswith(":"):
            continue  # internal junction-interior edge, not an approach road
        direction = _direction_for_edge(edge_id)
        if direction is None:
            continue
        kind = "in" if edge_id.endswith("_in") else "out"
        for lane in edge.findall("lane"):
            shape = lane.get("shape") or ""
            lanes.append(
                LaneGeometry(
                    id=lane.get("id") or "",
                    edge_id=edge_id,
                    direction=direction,
                    kind=kind,
                    shape=_parse_shape(shape),
                )
            )

    return NetworkGeometry(
        bounds=NetworkBounds(min_x=min_x, min_y=min_y, max_x=max_x, max_y=max_y),
        lanes=lanes,
    )
