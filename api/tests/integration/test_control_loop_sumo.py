"""One headless integration test: a short scenario run via `sumo` (not
`sumo-gui`) end-to-end through `sumo`, `scheduler`, and `schemas`, catching
integration regressions unit tests (which use fakes) can't see.
"""

from __future__ import annotations

from collections import Counter

import pytest

from mahanya.config import get_config
from mahanya.scheduler import Controller
from mahanya.sumo.traci_client import TraciClient

pytestmark = pytest.mark.integration


def test_control_loop_runs_a_short_scenario_end_to_end():
    config = get_config()
    client = TraciClient(
        config.simulation.sumocfg_path_for("sapon_peak.sumocfg"),
        tls_id=config.simulation.tls_id,
        seed=123,
        step_length=1.0,
        sumo_binary=config.simulation.sumo_binary,
        label="integration-test-control-loop",
    )
    client.start()
    controller = Controller(config.scheduler, dt=1.0, model=None)
    try:
        decisions = controller.run(client, scenario_id="integration-test", num_ticks=60)
    finally:
        client.close()

    assert len(decisions) == 60
    reason_codes = Counter(d.reason_code for d in decisions)
    # Every decision uses one of the five documented reason codes.
    assert set(reason_codes) <= {
        "model_accepted",
        "min_green_hold",
        "max_green_force",
        "anti_starvation_force",
        "emergency_preempt",
    }
    # Never a phase outside the declared 9-state space.
    from mahanya.schemas import ALL_PHASES

    assert all(d.applied_phase in ALL_PHASES for d in decisions)
    # Ticks are strictly increasing, one per control-loop step.
    assert [d.tick for d in decisions] == list(range(60))


def test_control_loop_with_trained_model_if_available():
    """Runs the same scenario through a trained model when a checkpoint is
    present; otherwise skipped (training is a separate offline step)."""

    config = get_config()
    if not config.model.checkpoint_path.exists():
        pytest.skip("no trained model checkpoint available")

    from mahanya.model.infer import ModelRecommender

    model = ModelRecommender.load(config.model.checkpoint_path, config.model)
    client = TraciClient(
        config.simulation.sumocfg_path_for("sapon_peak.sumocfg"),
        tls_id=config.simulation.tls_id,
        seed=456,
        step_length=1.0,
        sumo_binary=config.simulation.sumo_binary,
        label="integration-test-with-model",
    )
    client.start()
    controller = Controller(
        config.scheduler, dt=1.0, model=model, sequence_length=config.model.sequence_length
    )
    try:
        decisions = controller.run(client, scenario_id="integration-test-model", num_ticks=60)
    finally:
        client.close()

    assert len(decisions) == 60
    assert any(d.recommendation is not None for d in decisions)
