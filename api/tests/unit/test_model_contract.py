"""Contract/shape tests for `model`: verify input/output shapes and that
inference never raises on well-formed input. Explicitly not accuracy
assertions; accuracy is an evaluation concern, not a unit-test concern
(see ARCHITECTURE.md's testing strategy).
"""

from __future__ import annotations

import numpy as np
import pytest
import torch

from mahanya.config import ModelConfig
from mahanya.model.features import FEATURE_DIM, features_from_row, traffic_state_to_features
from mahanya.model.infer import ModelRecommender
from mahanya.model.transformer import PhaseTransformer
from mahanya.schemas import GREEN_PHASES
from tests.fixtures.traffic import make_traffic_state


@pytest.fixture
def model_config() -> ModelConfig:
    return ModelConfig(sequence_length=4, d_model=8, n_heads=2, n_layers=1, dim_feedforward=16)


def test_traffic_state_to_features_has_expected_dimension():
    state = make_traffic_state()
    features = traffic_state_to_features(state)
    assert features.shape == (FEATURE_DIM,)
    assert features.dtype == np.float32


def test_features_from_row_matches_traffic_state_to_features():
    state = make_traffic_state(tick=3, active_phase="EAST_GREEN", elapsed_phase_time_sec=7.5)
    row = {
        "active_phase": state.active_phase,
        "elapsed_phase_time_sec": state.elapsed_phase_time_sec,
    }
    for direction, approach in state.approaches.items():
        row[f"{direction}_vehicle_count"] = approach.vehicle_count
        row[f"{direction}_queue_length"] = approach.queue_length
        row[f"{direction}_waiting_time_sec"] = approach.waiting_time_sec
        row[f"{direction}_has_emergency_vehicle"] = approach.has_emergency_vehicle

    np.testing.assert_allclose(features_from_row(row), traffic_state_to_features(state))


def test_transformer_forward_produces_expected_logit_shape(model_config):
    model = PhaseTransformer(model_config)
    batch = torch.randn(5, model_config.sequence_length, FEATURE_DIM)
    logits = model(batch)
    assert logits.shape == (5, len(GREEN_PHASES))


def test_model_recommender_predict_shape_and_never_raises(model_config, tmp_path):
    model = PhaseTransformer(model_config)
    checkpoint_path = tmp_path / "model.pt"
    torch.save({"model_state_dict": model.state_dict()}, checkpoint_path)

    recommender = ModelRecommender.load(checkpoint_path, model_config)
    history = [make_traffic_state(tick=t) for t in range(model_config.sequence_length)]
    recommendation = recommender.predict(history)

    assert recommendation.recommended_phase in GREEN_PHASES
    assert 0.0 <= recommendation.confidence <= 1.0
    assert recommendation.phase_scores is not None
    assert set(recommendation.phase_scores) == set(GREEN_PHASES)
    assert pytest.approx(sum(recommendation.phase_scores.values()), abs=1e-4) == 1.0


def test_model_recommender_left_pads_short_history(model_config, tmp_path):
    model = PhaseTransformer(model_config)
    checkpoint_path = tmp_path / "model.pt"
    torch.save({"model_state_dict": model.state_dict()}, checkpoint_path)

    recommender = ModelRecommender.load(checkpoint_path, model_config)
    # Fewer states than sequence_length: must not raise.
    short_history = [make_traffic_state(tick=0)]
    recommendation = recommender.predict(short_history)
    assert recommendation.recommended_phase in GREEN_PHASES


def test_model_recommender_rejects_empty_history(model_config, tmp_path):
    model = PhaseTransformer(model_config)
    checkpoint_path = tmp_path / "model.pt"
    torch.save({"model_state_dict": model.state_dict()}, checkpoint_path)

    recommender = ModelRecommender.load(checkpoint_path, model_config)
    with pytest.raises(ValueError, match="history"):
        recommender.predict([])
