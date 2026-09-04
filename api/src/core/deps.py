"""Shared settings/dependency-injection callables used by `routes`.

`routes` depends on this module only, never on `core.app`, since
`core.app` is what imports and includes `routes`; the reverse dependency
would be a circular import at startup.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from core.simulation import ScenarioSession
from mahanya.config import Config, get_config
from mahanya.model.infer import ModelRecommender
from mahanya.scenarios import get_scenario_def
from mahanya.schemas import ScenarioStatus

logger = logging.getLogger(__name__)


@lru_cache
def get_settings() -> Config:
    return get_config()


@lru_cache
def get_model() -> ModelRecommender | None:
    config = get_settings()
    if not config.model.checkpoint_path.exists():
        logger.warning(
            "No trained model checkpoint at %s; scheduler will run on deterministic "
            "fallback only (no model recommendations).",
            config.model.checkpoint_path,
        )
        return None
    return ModelRecommender.load(config.model.checkpoint_path, config.model)


class SessionRegistry:
    """One `ScenarioSession` per scenario id, created lazily on first use."""

    def __init__(self) -> None:
        self._sessions: dict[str, ScenarioSession] = {}

    def get_or_create(self, scenario_id: str) -> ScenarioSession:
        if scenario_id not in self._sessions:
            settings = get_settings()
            scenario_def = get_scenario_def(scenario_id)
            self._sessions[scenario_id] = ScenarioSession(
                settings, scenario_def, get_model(), settings.dashboard.decision_log_path
            )
        return self._sessions[scenario_id]

    def existing(self, scenario_id: str) -> ScenarioSession | None:
        return self._sessions.get(scenario_id)

    def all_statuses(self) -> dict[str, ScenarioStatus]:
        return {
            scenario_id: session.scenario.status for scenario_id, session in self._sessions.items()
        }


_registry = SessionRegistry()


def get_registry() -> SessionRegistry:
    return _registry
