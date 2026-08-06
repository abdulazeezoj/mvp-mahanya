"""In-memory scenario session: owns the background thread driving a TraCI
client + the scheduler `Controller` for one scenario, with thread-safe
snapshot access for the FastAPI routes.

TraCI/SUMO is a blocking, synchronous process, so each session runs its own
daemon thread rather than blocking the FastAPI event loop; routes only ever
read the latest snapshot or flip a threading.Event.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from pathlib import Path

from mahanya.config import Config
from mahanya.model.infer import ModelRecommender
from mahanya.scenarios import ScenarioDef
from mahanya.scheduler import Controller
from mahanya.schemas import Scenario, ScenarioStatus, SchedulerDecision, TrafficState
from mahanya.sumo.traci_client import TraciClient

logger = logging.getLogger(__name__)


class ScenarioSession:
    """Owns one scenario's live run. One instance per scenario id, reused
    across start/pause/step/reset cycles."""

    def __init__(
        self,
        config: Config,
        scenario_def: ScenarioDef,
        model: ModelRecommender | None,
        decision_log_path: Path | None,
    ) -> None:
        self._config = config
        self._def = scenario_def
        self._model = model
        self._decision_log_path = decision_log_path
        self._lock = threading.RLock()
        self._status: ScenarioStatus = "idle"
        self._latest_state: TrafficState | None = None
        self._latest_decision: SchedulerDecision | None = None
        self._decision_log: deque[SchedulerDecision] = deque(maxlen=config.dashboard.max_history)
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._paused = threading.Event()
        self._client: TraciClient | None = None
        self._controller: Controller | None = None
        self._tick = 0

    @property
    def refresh_interval_sec(self) -> float:
        return self._config.dashboard.refresh_interval_sec

    @property
    def scenario(self) -> Scenario:
        with self._lock:
            return Scenario(
                id=self._def.id, name=self._def.name, status=self._status, seed=self._def.seed
            )

    def latest_state(self) -> TrafficState | None:
        with self._lock:
            return self._latest_state

    def latest_decision(self) -> SchedulerDecision | None:
        with self._lock:
            return self._latest_decision

    def decision_log(self, limit: int) -> list[SchedulerDecision]:
        with self._lock:
            return list(self._decision_log)[-limit:]

    def start(self) -> None:
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                if self._status == "paused":
                    self._paused.clear()
                    self._status = "running"
                return
            self._stop.clear()
            self._paused.clear()
            self._status = "running"
            sumocfg = self._config.simulation.sumocfg_path_for(self._def.sumocfg_file)
            self._client = TraciClient(
                sumocfg,
                tls_id=self._config.simulation.tls_id,
                seed=self._def.seed,
                step_length=self._config.simulation.step_length_sec,
                sumo_binary=self._config.simulation.sumo_binary,
                label=f"session-{self._def.id}-{id(self)}",
            )
            self._client.start()
            self._controller = Controller(
                self._config.scheduler,
                dt=self._config.simulation.control_interval_sec,
                model=self._model,
                sequence_length=self._config.model.sequence_length,
                decision_log_path=self._decision_log_path,
            )
            self._tick = 0
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def pause(self) -> None:
        with self._lock:
            if self._status == "running":
                self._paused.set()
                self._status = "paused"

    def step(self) -> None:
        """Advance exactly one tick; only meaningful while paused."""

        with self._lock:
            if self._status != "paused" or self._client is None or self._controller is None:
                return
            if not self._client.time_remaining():
                self._status = "completed"
                return
            self._advance_one_tick()

    def reset(self) -> None:
        with self._lock:
            self._stop.set()
            self._paused.clear()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=5)
        with self._lock:
            if self._client is not None:
                self._client.close()
            self._client = None
            self._controller = None
            self._latest_state = None
            self._latest_decision = None
            self._decision_log.clear()
            self._status = "idle"
            self._tick = 0
            self._thread = None

    def _advance_one_tick(self) -> None:
        assert self._client is not None
        assert self._controller is not None
        traffic = self._client.observe(self._def.id, self._tick)
        decision = self._controller.step(traffic)
        self._client.apply(decision.applied_phase)
        self._client.advance()
        self._tick += 1
        self._latest_state = traffic
        self._latest_decision = decision
        self._decision_log.append(decision)

    def _run_loop(self) -> None:
        try:
            while not self._stop.is_set():
                if self._paused.is_set():
                    time.sleep(0.1)
                    continue
                with self._lock:
                    if self._client is None or not self._client.time_remaining():
                        self._status = "completed"
                        break
                    self._advance_one_tick()
                time.sleep(self._config.simulation.control_interval_sec)
        except Exception:
            logger.exception("Scenario session %s failed", self._def.id)
            with self._lock:
                self._status = "idle"
        finally:
            with self._lock:
                if self._client is not None and self._status in ("completed", "idle"):
                    self._client.close()
