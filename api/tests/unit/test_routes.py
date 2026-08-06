"""FastAPI route tests, using dependency overrides so they never touch a
real SUMO/TraCI process — only route wiring, status codes, and payload
shape are under test here.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from core.app import create_app
from core.deps import get_registry
from mahanya.schemas import Scenario, ScenarioStatus, SchedulerDecision, TrafficState
from tests.fixtures.traffic import make_traffic_state


class FakeSession:
    def __init__(self, scenario_id: str) -> None:
        self._scenario_id = scenario_id
        self.status: ScenarioStatus = "idle"
        self.calls: list[str] = []
        self.refresh_interval_sec = 0.01

    @property
    def scenario(self) -> Scenario:
        return Scenario(id=self._scenario_id, name="Fake Scenario", status=self.status, seed=1)

    def start(self) -> None:
        self.calls.append("start")
        self.status = "running"

    def pause(self) -> None:
        self.calls.append("pause")
        self.status = "paused"

    def step(self) -> None:
        self.calls.append("step")

    def reset(self) -> None:
        self.calls.append("reset")
        self.status = "idle"

    def latest_state(self) -> TrafficState | None:
        return make_traffic_state(scenario_id=self._scenario_id, tick=7)

    def latest_decision(self) -> SchedulerDecision | None:
        state = self.latest_state()
        assert state is not None
        return SchedulerDecision(
            tick=state.tick,
            timestamp=state.timestamp,
            recommendation=None,
            applied_phase="NORTH_GREEN",
            reason_code="model_accepted",
        )

    def decision_log(self, limit: int) -> list[SchedulerDecision]:
        decision = self.latest_decision()
        assert decision is not None
        return [decision] * min(limit, 3)


class FakeRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, FakeSession] = {}

    def get_or_create(self, scenario_id: str) -> FakeSession:
        if scenario_id not in self._sessions:
            self._sessions[scenario_id] = FakeSession(scenario_id)
        return self._sessions[scenario_id]

    def all_statuses(self) -> dict[str, ScenarioStatus]:
        return {sid: s.status for sid, s in self._sessions.items()}


@pytest.fixture
def client():
    app = create_app()
    fake_registry = FakeRegistry()
    app.dependency_overrides[get_registry] = lambda: fake_registry
    with TestClient(app) as test_client:
        yield test_client, fake_registry
    app.dependency_overrides.clear()


def test_health(client):
    test_client, _ = client
    response = test_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_scenarios_returns_known_catalog(client):
    test_client, _ = client
    response = test_client.get("/api/scenarios")
    assert response.status_code == 200
    ids = {s["id"] for s in response.json()}
    assert ids == {"sapon-peak", "sapon-offpeak"}


def test_get_unknown_scenario_404s(client):
    test_client, _ = client
    response = test_client.get("/api/scenarios/does-not-exist")
    assert response.status_code == 404


def test_controls_run_pause_step_reset_lifecycle(client):
    test_client, registry = client

    response = test_client.post("/api/controls/sapon-peak/run")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

    response = test_client.post("/api/controls/sapon-peak/pause")
    assert response.json()["status"] == "paused"

    response = test_client.post("/api/controls/sapon-peak/step")
    assert response.status_code == 200

    response = test_client.post("/api/controls/sapon-peak/reset")
    assert response.json()["status"] == "idle"

    session = registry.get_or_create("sapon-peak")
    assert session.calls == ["start", "pause", "step", "reset"]


def test_controls_unknown_scenario_404s(client):
    test_client, _ = client
    response = test_client.post("/api/controls/nope/run")
    assert response.status_code == 404


def test_snapshots_state_and_decision(client):
    test_client, _ = client
    state_response = test_client.get("/api/snapshots/sapon-peak/state")
    assert state_response.status_code == 200
    assert state_response.json()["scenarioId"] == "sapon-peak"

    decision_response = test_client.get("/api/snapshots/sapon-peak/decision")
    assert decision_response.status_code == 200
    assert decision_response.json()["appliedPhase"] == "NORTH_GREEN"


def test_snapshots_decision_log_respects_limit(client):
    test_client, _ = client
    response = test_client.get("/api/snapshots/sapon-peak/decisions?limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_snapshots_unknown_scenario_404s(client):
    test_client, _ = client
    assert test_client.get("/api/snapshots/nope/state").status_code == 404
    assert test_client.get("/api/snapshots/nope/decision").status_code == 404
    assert test_client.get("/api/snapshots/nope/decisions").status_code == 404


def test_stream_pushes_state_and_decision_over_websocket(client):
    test_client, registry = client
    registry.get_or_create("sapon-peak")  # populate latest_state/latest_decision
    with test_client.websocket_connect("/api/streams/sapon-peak") as ws:
        message = ws.receive_json()
    assert message["state"]["scenarioId"] == "sapon-peak"
    assert message["decision"]["appliedPhase"] == "NORTH_GREEN"
