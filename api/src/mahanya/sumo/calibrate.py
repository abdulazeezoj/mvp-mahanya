"""Generate a calibrated .rou.xml from fitted arrival-distribution parameters.

Each direction gets one straight-through traffic flow (see
network/plain/sapon.con.xml — no protected-turn phases) whose insertion
rate is drawn from the fitted Poisson/negative-binomial parameters for that
direction/period, plus a low-probability "emergency" flow per direction so
pre-emption is exercised in generated scenarios. Civilian vehicles are
drawn from a shared `vTypeDistribution` (VEHICLE_TYPE_MIX) rather than
split into one flow per type: giving each type its own
`period="exp(rate)"` flow means two crossing directions end up with
several simultaneous low-rate probabilistic flows whose rates differ from
each other — which reproducibly hangs SUMO 1.18.0 at the very first
simulation step (observed hang, ~100% CPU / multi-GB RSS, no vehicles
inserted yet). A single per-direction flow keyed to a type distribution
avoids that combination entirely while still matching the *total* fitted
arrival rate exactly.
"""

from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET

from mahanya.data.distribution_fit import FitResult
from mahanya.schemas import ApproachDirection

DIRECTION_ROUTE: dict[ApproachDirection, tuple[str, str]] = {
    "north": ("north_in", "south_out"),
    "south": ("south_in", "north_out"),
    "east": ("east_in", "west_out"),
    "west": ("west_in", "east_out"),
}

#: Emergency vehicles as a small fixed fraction of a direction's flow,
#: independent of the fitted civilian-arrival rate.
EMERGENCY_VEH_PER_HOUR = 6.0

#: Assumed civilian traffic-composition mix, split off the single fitted
#: arrival rate per direction/period. This is a **placeholder assumption**,
#: not calibrated from field data — the field-count CSV
#: (api/data/raw/sapon_traffic_counts.csv) records only a single aggregate
#: vehicle_count per direction/period, with no per-type breakdown, the same
#: way that CSV's contents are themselves documented as synthetic pending a
#: real Sapon Under-bridge Junction survey. Swap these ratios for a real
#: classified count if/when one becomes available.
VEHICLE_TYPE_MIX: dict[str, float] = {
    "car": 0.70,
    "motorcycle": 0.20,
    "bus": 0.05,
    "truck": 0.05,
}


def mean_arrivals_per_hour(fit: FitResult) -> float:
    """Convert a fitted per-5-minute-interval mean into vehicles/hour."""

    return fit.mean_arrivals * 12.0


def generate_routes(
    fit_results: list[FitResult],
    period: str,
    duration_sec: int,
    output_path: Path,
    include_emergency: bool = True,
) -> None:
    """Write a .rou.xml calibrated to the fitted arrival rates for one period."""

    by_direction = {r.direction: r for r in fit_results if r.period == period}
    missing = set(DIRECTION_ROUTE) - set(by_direction)
    if missing:
        raise ValueError(f"no fit results for period={period!r}, directions={sorted(missing)}")

    root = ET.Element("routes")
    ET.SubElement(
        root,
        "vType",
        {
            "id": "car",
            "vClass": "passenger",
            "length": "5",
            "maxSpeed": "16.7",
            "accel": "2.6",
            "decel": "4.5",
            "probability": str(VEHICLE_TYPE_MIX["car"]),
        },
    )
    ET.SubElement(
        root,
        "vType",
        {
            "id": "motorcycle",
            "vClass": "motorcycle",
            "length": "2.2",
            "maxSpeed": "18.0",
            "accel": "3.5",
            "decel": "5.5",
            "probability": str(VEHICLE_TYPE_MIX["motorcycle"]),
        },
    )
    ET.SubElement(
        root,
        "vType",
        {
            "id": "bus",
            "vClass": "bus",
            "length": "12",
            "maxSpeed": "13.0",
            "accel": "1.2",
            "decel": "3.5",
            "probability": str(VEHICLE_TYPE_MIX["bus"]),
        },
    )
    ET.SubElement(
        root,
        "vType",
        {
            "id": "truck",
            "vClass": "truck",
            "length": "8",
            "maxSpeed": "14.0",
            "accel": "1.3",
            "decel": "4.0",
            "probability": str(VEHICLE_TYPE_MIX["truck"]),
        },
    )
    ET.SubElement(
        root,
        "vTypeDistribution",
        {"id": "civilian", "vTypes": " ".join(VEHICLE_TYPE_MIX)},
    )
    ET.SubElement(
        root,
        "vType",
        {
            "id": "emergency",
            "vClass": "emergency",
            "length": "6",
            "maxSpeed": "20.0",
            "accel": "3.0",
            "decel": "5.0",
            "color": "1,0,0",
        },
    )

    for direction, (from_edge, to_edge) in DIRECTION_ROUTE.items():
        fit = by_direction[direction]
        veh_per_hour = mean_arrivals_per_hour(fit)
        # Exponentially distributed inter-departure times, matching a
        # Poisson arrival process (interarrival times ~ Exp(rate)) rather
        # than SUMO's default uniform spacing, so calibrated flows actually
        # reproduce the fitted arrival distribution's variance, not just
        # its mean. Vehicle type is resolved per-insertion from the
        # "civilian" vTypeDistribution (VEHICLE_TYPE_MIX), so the *total*
        # civilian rate still equals the fitted distribution exactly.
        ET.SubElement(
            root,
            "flow",
            {
                "id": f"{direction}_civilian_flow",
                "type": "civilian",
                "from": from_edge,
                "to": to_edge,
                "begin": "0",
                "end": str(duration_sec),
                "period": f"exp({veh_per_hour / 3600.0:.6f})",
                "departLane": "best",
                "departSpeed": "max",
            },
        )
        if include_emergency:
            ET.SubElement(
                root,
                "flow",
                {
                    "id": f"{direction}_emergency_flow",
                    "type": "emergency",
                    "from": from_edge,
                    "to": to_edge,
                    "begin": "0",
                    "end": str(duration_sec),
                    "period": f"exp({EMERGENCY_VEH_PER_HOUR / 3600.0:.6f})",
                    "departLane": "best",
                    "departSpeed": "max",
                },
            )

    tree = ET.ElementTree(root)
    ET.indent(tree, space="    ")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(output_path, encoding="UTF-8", xml_declaration=True)


def write_sumocfg(
    net_file: str,
    route_file: str,
    output_path: Path,
    duration_sec: int,
    step_length_sec: float = 1.0,
) -> None:
    root = ET.Element("configuration")
    inputs = ET.SubElement(root, "input")
    ET.SubElement(inputs, "net-file", {"value": net_file})
    ET.SubElement(inputs, "route-files", {"value": route_file})

    time = ET.SubElement(root, "time")
    ET.SubElement(time, "begin", {"value": "0"})
    ET.SubElement(time, "end", {"value": str(duration_sec)})
    ET.SubElement(time, "step-length", {"value": str(step_length_sec)})

    processing = ET.SubElement(root, "processing")
    ET.SubElement(processing, "time-to-teleport", {"value": "300"})
    ET.SubElement(processing, "collision.action", {"value": "warn"})

    tree = ET.ElementTree(root)
    ET.indent(tree, space="    ")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(output_path, encoding="UTF-8", xml_declaration=True)
