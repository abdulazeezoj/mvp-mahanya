"""Tests for the layered `mahanya.config` settings surface."""

from __future__ import annotations

from mahanya.config import Config, get_config


def test_get_config_returns_nested_defaults():
    config = get_config()
    assert config.scheduler.min_green_sec > 0
    assert config.scheduler.max_green_sec >= config.scheduler.min_green_sec
    assert config.simulation.net_path.name == "sapon.net.xml"
    assert config.model.checkpoint_path.name == "phase_recommender.pt"


def test_sumocfg_path_for_resolves_within_network_dir():
    config = get_config()
    path = config.simulation.sumocfg_path_for("sapon_peak.sumocfg")
    assert path.parent == config.simulation.network_dir
    assert path.name == "sapon_peak.sumocfg"


def test_env_var_overrides_nested_scheduler_threshold(monkeypatch):
    monkeypatch.setenv("MAHANYA_SCHEDULER__MIN_GREEN_SEC", "42")
    config = Config()
    assert config.scheduler.min_green_sec == 42.0


def test_init_kwargs_take_precedence_over_defaults():
    from mahanya.config import SchedulerThresholds

    config = Config(scheduler=SchedulerThresholds(min_green_sec=99.0))
    assert config.scheduler.min_green_sec == 99.0
