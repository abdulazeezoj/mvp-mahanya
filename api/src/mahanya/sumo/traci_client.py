"""Thin TraCI client: connect, step, read state, set phase.

Owns all direct TraCI/SUMO process interaction so nothing else in
``mahanya`` needs to know TraCI's API shape. Multiple clients can run
concurrently via TraCI's labelled-connection support (one SUMO subprocess
per label), which ``routes.controls`` uses to run several scenarios at
once.
"""

from __future__ import annotations

import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from mahanya.schemas import ALL_PHASES, ApproachDirection, Phase, TrafficState
from mahanya.sumo.state_extractor import extract_traffic_state


def _ensure_sumo_tools_on_path() -> None:
    sumo_home = os.environ.get("SUMO_HOME", "/usr/share/sumo")
    tools = Path(sumo_home) / "tools"
    if tools.is_dir() and str(tools) not in sys.path:
        sys.path.insert(0, str(tools))


_ensure_sumo_tools_on_path()

import traci  # noqa: E402

IN_EDGE_BY_DIRECTION: dict[ApproachDirection, str] = {
    "north": "north_in",
    "south": "south_in",
    "east": "east_in",
    "west": "west_in",
}


def _net_file_path(sumocfg_path: Path) -> Path:
    tree = ET.parse(sumocfg_path)
    net_file = tree.getroot().find("./input/net-file")
    value = net_file.get("value") if net_file is not None else None
    if value is None:
        raise ValueError(f"no <net-file> declared in {sumocfg_path}")
    return sumocfg_path.parent / value


def _load_phase_states(net_file: Path, tls_id: str) -> dict[Phase, str]:
    """Read the `mahanya`-authored tlLogic phase list, in ALL_PHASES order.

    build_network.py writes the program's <phase> elements in exactly
    ALL_PHASES order, so this is the single source of truth for the
    Phase -> SUMO state-string mapping; nothing here re-derives link
    indices or connection directions independently.
    """

    root = ET.parse(net_file).getroot()
    for tl_logic in root.findall("tlLogic"):
        if tl_logic.get("id") != tls_id:
            continue
        phases = tl_logic.findall("phase")
        if len(phases) != len(ALL_PHASES):
            raise ValueError(
                f"tlLogic {tls_id!r} has {len(phases)} phases, expected {len(ALL_PHASES)}"
            )
        return {name: p.get("state") or "" for name, p in zip(ALL_PHASES, phases, strict=True)}
    raise ValueError(f"no tlLogic with id={tls_id!r} found in {net_file}")


class TraciClient:
    """Drives one SUMO scenario over TraCI."""

    def __init__(
        self,
        sumocfg_path: Path,
        tls_id: str = "J_sapon",
        seed: int = 0,
        step_length: float = 1.0,
        sumo_binary: str = "sumo",
        gui: bool = False,
        label: str | None = None,
        start_phase: Phase = "NORTH_GREEN",
    ) -> None:
        self._sumocfg_path = sumocfg_path
        self._tls_id = tls_id
        self._seed = seed
        self._step_length = step_length
        self._binary = "sumo-gui" if gui else sumo_binary
        self._label = label or f"mahanya-{id(self)}"
        self._connected = False
        self._current_phase: Phase = start_phase
        self._phase_elapsed_sec = 0.0
        self._phase_states = _load_phase_states(_net_file_path(sumocfg_path), tls_id)

    def start(self) -> None:
        cmd = [
            self._binary,
            "-c",
            str(self._sumocfg_path),
            "--seed",
            str(self._seed),
            "--step-length",
            str(self._step_length),
            "--no-step-log",
            "--no-warnings",
        ]
        traci.start(cmd, label=self._label)
        self._conn = traci.getConnection(self._label)
        self._conn.trafficlight.setRedYellowGreenState(
            self._tls_id, self._phase_states[self._current_phase]
        )
        self._connected = True

    def close(self) -> None:
        if self._connected:
            self._conn.close()
            self._connected = False

    def apply(self, phase: Phase) -> None:
        if phase != self._current_phase:
            self._current_phase = phase
            self._phase_elapsed_sec = 0.0
        self._conn.trafficlight.setRedYellowGreenState(self._tls_id, self._phase_states[phase])

    def advance(self) -> None:
        self._conn.simulationStep()
        self._phase_elapsed_sec += self._step_length

    def time_remaining(self) -> bool:
        return bool(self._conn.simulation.getMinExpectedNumber() > 0)

    def observe(self, scenario_id: str, tick: int) -> TrafficState:
        return extract_traffic_state(
            self._conn,
            scenario_id=scenario_id,
            tick=tick,
            active_phase=self._current_phase,
            elapsed_phase_time_sec=self._phase_elapsed_sec,
        )

    def arrived_vehicle_ids(self) -> list[str]:
        """Vehicle IDs that completed their route during the last `advance()`."""

        return list(self._conn.simulation.getArrivedIDList())

    def emergency_vehicle_ids_present(self) -> list[str]:
        """Emergency-class vehicle IDs currently on any approach edge."""

        ids: list[str] = []
        for edge_id in IN_EDGE_BY_DIRECTION.values():
            for vehicle_id in self._conn.edge.getLastStepVehicleIDs(edge_id):
                if self._conn.vehicle.getVehicleClass(vehicle_id) == "emergency":
                    ids.append(vehicle_id)
        return ids
