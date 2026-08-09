"""Compile the plain-XML Sapon junction definition into net.xml via netconvert,
then replace netconvert's auto-generated traffic-light program with MaHanya's
9-phase single-ring program (see mahanya.schemas.traffic.ALL_PHASES).

Re-run whenever the plain-XML sources under network/plain/ change:

    uv run python scripts/build_network.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from mahanya.schemas import ALL_PHASES  # noqa: E402 (after sys.path patch)

NETWORK_DIR = Path(__file__).resolve().parents[1] / "src" / "mahanya" / "sumo" / "network"
PLAIN_DIR = NETWORK_DIR / "plain"
NET_FILE = NETWORK_DIR / "sapon.net.xml"
TL_ID = "J_sapon"

DIRECTION_BY_IN_EDGE = {
    "north_in": "NORTH",
    "south_in": "SOUTH",
    "east_in": "EAST",
    "west_in": "WEST",
}

#: (state-suffix, duration seconds) — duration is only the *default*
#: standalone-SUMO program; TraCI overrides state live every control tick.
PHASE_DURATIONS = {
    "GREEN": 30,
    "YELLOW": 3,
    "ALL_RED": 2,
}


def run_netconvert() -> None:
    netconvert = shutil.which("netconvert")
    if netconvert is None:
        raise RuntimeError("netconvert not found on PATH; install the sumo package")

    cmd = [
        netconvert,
        "--node-files", str(PLAIN_DIR / "sapon.nod.xml"),
        "--edge-files", str(PLAIN_DIR / "sapon.edg.xml"),
        "--connection-files", str(PLAIN_DIR / "sapon.con.xml"),
        "--output-file", str(NET_FILE),
        "--no-turnarounds",
        "--tls.default-type", "static",
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def _direction_for_link(tree: ET.ElementTree, link_index: int) -> str:
    root = tree.getroot()
    for conn in root.findall("connection"):
        if conn.get("tl") == TL_ID and conn.get("linkIndex") == str(link_index):
            return DIRECTION_BY_IN_EDGE[conn.get("from")]
    raise ValueError(f"no signal-controlled connection found for linkIndex={link_index}")


def build_phase_state(tree: ET.ElementTree, num_links: int, active_direction: str, indication: str) -> str:
    chars = []
    for link_index in range(num_links):
        direction = _direction_for_link(tree, link_index)
        if direction != active_direction:
            chars.append("r")
        elif indication == "GREEN":
            chars.append("G")
        elif indication == "YELLOW":
            chars.append("y")
        else:
            chars.append("r")
    return "".join(chars)


def patch_tl_logic() -> None:
    tree = ET.parse(NET_FILE)
    root = tree.getroot()

    num_links = max(
        int(c.get("linkIndex"))
        for c in root.findall("connection")
        if c.get("tl") == TL_ID
    ) + 1

    for tl_logic in [e for e in root.findall("tlLogic") if e.get("id") == TL_ID]:
        root.remove(tl_logic)

    new_logic = ET.Element(
        "tlLogic", {"id": TL_ID, "type": "static", "programID": "mahanya", "offset": "0"}
    )
    for phase_name in ALL_PHASES:
        if phase_name == "ALL_RED":
            state = "r" * num_links
            duration = PHASE_DURATIONS["ALL_RED"]
        else:
            direction, indication = phase_name.rsplit("_", 1)
            state = build_phase_state(tree, num_links, direction, indication)
            duration = PHASE_DURATIONS[indication]
        ET.SubElement(new_logic, "phase", {"duration": str(duration), "state": state})

    # tlLogic elements must appear before the first junction element, per
    # SUMO's net.xml schema.
    first_junction_index = next(
        i for i, e in enumerate(root) if e.tag == "junction"
    )
    root.insert(first_junction_index, new_logic)

    ET.indent(tree, space="    ")
    tree.write(NET_FILE, encoding="UTF-8", xml_declaration=True)


def main() -> None:
    run_netconvert()
    patch_tl_logic()
    print(f"Wrote {NET_FILE}")


if __name__ == "__main__":
    main()
