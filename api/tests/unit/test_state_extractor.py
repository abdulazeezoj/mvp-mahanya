"""`state_extractor.extract_traffic_state` against a fake TraCI connection:
the whole point of the `TraciConnectionLike` Protocol split from
`TraciClient` is that this needs no running SUMO process.
"""

from __future__ import annotations

from mahanya.sumo.state_extractor import (
    IN_EDGE_BY_DIRECTION,
    TraciEdgeApi,
    TraciVehicleApi,
    extract_traffic_state,
)


class FakeEdgeApi:
    def __init__(self) -> None:
        self.vehicles_by_edge: dict[str, list[str]] = {}
        self.halting_by_edge: dict[str, int] = {}
        self.waiting_time_by_edge: dict[str, float] = {}

    def getLastStepVehicleIDs(self, edge_id: str) -> list[str]:
        return self.vehicles_by_edge.get(edge_id, [])

    def getLastStepVehicleNumber(self, edge_id: str) -> int:
        return len(self.vehicles_by_edge.get(edge_id, []))

    def getLastStepHaltingNumber(self, edge_id: str) -> int:
        return self.halting_by_edge.get(edge_id, 0)

    def getWaitingTime(self, edge_id: str) -> float:
        return self.waiting_time_by_edge.get(edge_id, 0.0)


class FakeVehicleApi:
    def __init__(self, emergency_ids: set[str], ids: list[str] | None = None) -> None:
        self.emergency_ids = emergency_ids
        self.ids = ids if ids is not None else []
        self.positions: dict[str, tuple[float, float]] = {}
        self.angles: dict[str, float] = {}
        self.type_ids: dict[str, str] = {}

    def getIDList(self) -> list[str]:
        return self.ids

    def getVehicleClass(self, vehicle_id: str) -> str:
        return "emergency" if vehicle_id in self.emergency_ids else "passenger"

    def getPosition(self, vehicle_id: str) -> tuple[float, float]:
        return self.positions.get(vehicle_id, (0.0, 0.0))

    def getAngle(self, vehicle_id: str) -> float:
        return self.angles.get(vehicle_id, 0.0)

    def getTypeID(self, vehicle_id: str) -> str:
        if vehicle_id in self.type_ids:
            return self.type_ids[vehicle_id]
        return "emergency" if vehicle_id in self.emergency_ids else "car"


class FakeConnection:
    def __init__(self, edge: TraciEdgeApi, vehicle: TraciVehicleApi) -> None:
        self.edge = edge
        self.vehicle = vehicle


def test_extract_traffic_state_reads_all_four_approaches():
    edge = FakeEdgeApi()
    edge.vehicles_by_edge["north_in"] = ["v1", "v2"]
    edge.halting_by_edge["north_in"] = 1
    edge.waiting_time_by_edge["north_in"] = 12.5
    conn = FakeConnection(edge, FakeVehicleApi(emergency_ids=set()))

    state = extract_traffic_state(
        conn, "s1", tick=3, active_phase="NORTH_GREEN", elapsed_phase_time_sec=2.0
    )

    assert state.scenario_id == "s1"
    assert state.tick == 3
    assert state.active_phase == "NORTH_GREEN"
    assert state.approaches.north.vehicle_count == 2
    assert state.approaches.north.queue_length == 1
    assert state.approaches.north.waiting_time_sec == 12.5
    assert state.approaches.south.vehicle_count == 0


def test_extract_traffic_state_flags_emergency_vehicle_by_class():
    edge = FakeEdgeApi()
    edge.vehicles_by_edge["east_in"] = ["ambulance-1", "car-1"]
    conn = FakeConnection(edge, FakeVehicleApi(emergency_ids={"ambulance-1"}))

    state = extract_traffic_state(
        conn, "s1", tick=0, active_phase="EAST_GREEN", elapsed_phase_time_sec=0.0
    )

    assert state.approaches.east.has_emergency_vehicle is True
    assert state.approaches.west.has_emergency_vehicle is False


def test_in_edge_mapping_covers_all_four_directions():
    assert set(IN_EDGE_BY_DIRECTION) == {"north", "south", "east", "west"}


def test_extract_traffic_state_includes_network_wide_vehicle_positions():
    edge = FakeEdgeApi()
    vehicle = FakeVehicleApi(emergency_ids={"ambulance-1"}, ids=["ambulance-1", "car-1", "bike-1"])
    vehicle.positions = {
        "ambulance-1": (10.0, 20.0),
        "car-1": (30.0, 40.0),
        "bike-1": (50.0, 60.0),
    }
    vehicle.angles = {"ambulance-1": 90.0, "car-1": 180.0, "bike-1": 45.0}
    vehicle.type_ids = {"bike-1": "motorcycle"}
    conn = FakeConnection(edge, vehicle)

    state = extract_traffic_state(
        conn, "s1", tick=0, active_phase="NORTH_GREEN", elapsed_phase_time_sec=0.0
    )

    assert {v.vehicle_id for v in state.vehicles} == {"ambulance-1", "car-1", "bike-1"}
    ambulance = next(v for v in state.vehicles if v.vehicle_id == "ambulance-1")
    assert (ambulance.x, ambulance.y, ambulance.angle_deg) == (10.0, 20.0, 90.0)
    assert ambulance.vehicle_type == "emergency"
    car = next(v for v in state.vehicles if v.vehicle_id == "car-1")
    assert car.vehicle_type == "car"
    bike = next(v for v in state.vehicles if v.vehicle_id == "bike-1")
    assert bike.vehicle_type == "motorcycle"
