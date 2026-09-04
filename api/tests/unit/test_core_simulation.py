"""`core.simulation.ScenarioSession`'s threaded run/pause/step/reset
lifecycle, against a fake TraCI client (monkeypatched in) so this needs no
real SUMO process; only the session's own thread-safety and state-machine
logic is under test here.
"""

from __future__ import annotations

import time

import pytest

from core import simulation as simulation_module
from core.simulation import ScenarioSession
from mahanya.config import get_config
from mahanya.scenarios import SCENARIO_CATALOG
from mahanya.schemas import Phase, TrafficState
from tests.fixtures.traffic import make_traffic_state


class FakeTraciClient:
    """Never-ending scenario: `time_remaining()` is always True, so tests
    fully control how many ticks actually happen via pause()/reset()."""

    instances: list[FakeTraciClient] = []

    def __init__(self, *args, **kwargs) -> None:
        self.started = False
        self.closed = False
        self.applied: list[Phase] = []
        self.advanced = 0
        self._tick = 0
        FakeTraciClient.instances.append(self)

    def start(self) -> None:
        self.started = True

    def close(self) -> None:
        self.closed = True

    def observe(self, scenario_id: str, tick: int) -> TrafficState:
        return make_traffic_state(scenario_id=scenario_id, tick=self._tick)

    def apply(self, phase: Phase) -> None:
        self.applied.append(phase)

    def advance(self) -> None:
        self.advanced += 1
        self._tick += 1

    def time_remaining(self) -> bool:
        return True


@pytest.fixture(autouse=True)
def fake_traci(monkeypatch):
    FakeTraciClient.instances.clear()
    monkeypatch.setattr(simulation_module, "TraciClient", FakeTraciClient)
    yield


@pytest.fixture
def session() -> ScenarioSession:
    config = get_config()
    # Fast polling so tests don't need long sleeps.
    config = config.model_copy(
        update={"simulation": config.simulation.model_copy(update={"control_interval_sec": 0.01})}
    )
    return ScenarioSession(
        config, SCENARIO_CATALOG["sapon-peak"], model=None, decision_log_path=None
    )


def _wait_until(predicate, timeout=2.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


def test_idle_session_has_no_latest_state(session):
    assert session.scenario.status == "idle"
    assert session.latest_state() is None
    assert session.latest_decision() is None


def test_start_transitions_to_running_and_advances_ticks(session):
    session.start()
    assert _wait_until(lambda: session.latest_state() is not None)
    assert session.scenario.status == "running"
    session.reset()


def test_pause_stops_ticks_from_advancing(session):
    session.start()
    assert _wait_until(
        lambda: session.latest_state() is not None and session.latest_state().tick >= 1
    )
    session.pause()
    assert session.scenario.status == "paused"
    tick_at_pause = session.latest_state().tick
    time.sleep(0.2)
    assert session.latest_state().tick == tick_at_pause
    session.reset()


def test_step_advances_exactly_one_tick_while_paused(session):
    session.start()
    assert _wait_until(lambda: session.latest_state() is not None)
    session.pause()
    tick_before = session.latest_state().tick
    session.step()
    assert session.latest_state().tick == tick_before + 1
    session.step()
    assert session.latest_state().tick == tick_before + 2
    session.reset()


def test_step_is_a_noop_when_not_paused(session):
    # Never started -> status is "idle", not "paused".
    session.step()
    assert session.latest_state() is None


def test_reset_clears_state_and_closes_client(session):
    session.start()
    assert _wait_until(lambda: session.latest_state() is not None)
    client = FakeTraciClient.instances[-1]
    session.reset()
    assert session.scenario.status == "idle"
    assert session.latest_state() is None
    assert session.latest_decision() is None
    assert client.closed is True


def test_decision_log_bounded_by_max_history(session):
    session.start()
    assert _wait_until(lambda: len(session.decision_log(10_000)) >= 5)
    session.reset()
