"""Translate raw SUMO/TraCI state into the shared `TrafficState` contract.

Kept separate from `traci_client.TraciClient` so the SUMO-state -> schema
translation can be unit-tested against a fake connection object, without a
running SUMO process.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol

from mahanya.schemas import (
    ApproachDirection,
    ApproachState,
    Phase,
    TrafficDirection,
    TrafficState,
    VehiclePosition,
)

IN_EDGE_BY_DIRECTION: dict[ApproachDirection, str] = {
    "north": "north_in",
    "south": "south_in",
    "east": "east_in",
    "west": "west_in",
}


class TraciEdgeApi(Protocol):
    def getLastStepVehicleIDs(self, edge_id: str) -> list[str]: ...
    def getLastStepVehicleNumber(self, edge_id: str) -> int: ...
    def getLastStepHaltingNumber(self, edge_id: str) -> int: ...
    def getWaitingTime(self, edge_id: str) -> float: ...


class TraciVehicleApi(Protocol):
    def getIDList(self) -> list[str]: ...
    def getVehicleClass(self, vehicle_id: str) -> str: ...
    def getPosition(self, vehicle_id: str) -> tuple[float, float]: ...
    def getAngle(self, vehicle_id: str) -> float: ...
    def getTypeID(self, vehicle_id: str) -> str: ...


class TraciConnectionLike(Protocol):
    edge: TraciEdgeApi
    vehicle: TraciVehicleApi


def extract_traffic_state(
    conn: TraciConnectionLike,
    scenario_id: str,
    tick: int,
    active_phase: Phase,
    elapsed_phase_time_sec: float,
) -> TrafficState:
    approaches: dict[str, ApproachState] = {}
    for direction, edge_id in IN_EDGE_BY_DIRECTION.items():
        vehicle_ids = conn.edge.getLastStepVehicleIDs(edge_id)
        has_emergency = any(conn.vehicle.getVehicleClass(vid) == "emergency" for vid in vehicle_ids)
        approaches[direction] = ApproachState(
            vehicle_count=conn.edge.getLastStepVehicleNumber(edge_id),
            queue_length=conn.edge.getLastStepHaltingNumber(edge_id),
            waiting_time_sec=conn.edge.getWaitingTime(edge_id),
            has_emergency_vehicle=has_emergency,
        )
    vehicles: list[VehiclePosition] = []
    for vehicle_id in conn.vehicle.getIDList():
        x, y = conn.vehicle.getPosition(vehicle_id)
        vehicles.append(
            VehiclePosition(
                vehicle_id=vehicle_id,
                x=x,
                y=y,
                angle_deg=conn.vehicle.getAngle(vehicle_id),
                # SUMO vType ids are exactly the VehicleType values by
                # construction (mahanya.sumo.calibrate defines the vTypes),
                # so no re-derivation from vClass is needed here.
                vehicle_type=conn.vehicle.getTypeID(vehicle_id),
            )
        )
    return TrafficState(
        scenario_id=scenario_id,
        tick=tick,
        timestamp=datetime.now(UTC),
        approaches=TrafficDirection(**approaches),
        active_phase=active_phase,
        elapsed_phase_time_sec=elapsed_phase_time_sec,
        vehicles=vehicles,
    )
