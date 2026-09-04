"""Integration test for the heavier `/api/snapshots/{id}/evaluation` route,
which spins up two real SUMO subprocesses (intelligent vs. fixed-time),
too slow/SUMO-dependent for the fake-registry route tests in
tests/unit/test_routes.py.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from core.app import create_app
from routes.snapshots import EVALUATION_TICKS

pytestmark = pytest.mark.integration


def test_evaluation_route_runs_both_controllers_against_real_sumo(monkeypatch):
    # Keep the integration test fast: run a short scenario slice instead of
    # the full default window.
    monkeypatch.setattr("routes.snapshots.EVALUATION_TICKS", min(EVALUATION_TICKS, 120))

    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/snapshots/sapon-offpeak/evaluation")

    assert response.status_code == 200
    payload = response.json()
    assert {m["controller"] for m in payload} == {"intelligent", "fixed-time"}
    for metrics in payload:
        assert metrics["scenarioId"] == "sapon-offpeak"
        assert metrics["throughputVehPerHour"] >= 0
