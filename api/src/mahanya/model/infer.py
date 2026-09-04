"""Load a trained `PhaseTransformer` checkpoint and produce `PhaseRecommendation`s.

`ModelRecommender` structurally implements
`mahanya.scheduler.controller.PhaseRecommender`; the scheduler never
imports this module directly, only the Protocol it satisfies.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import torch
import torch.nn.functional as F

from mahanya.config import ModelConfig
from mahanya.model.features import sequence_to_tensor
from mahanya.model.transformer import PhaseTransformer
from mahanya.schemas import GREEN_PHASES, PhaseRecommendation, TrafficState


class ModelRecommender:
    def __init__(self, model: PhaseTransformer, sequence_length: int) -> None:
        self._model = model
        self._model.eval()
        self._sequence_length = sequence_length

    @classmethod
    def load(cls, checkpoint_path: Path, model_config: ModelConfig) -> ModelRecommender:
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        model = PhaseTransformer(model_config)
        model.load_state_dict(checkpoint["model_state_dict"])
        return cls(model, model_config.sequence_length)

    def predict(self, history: Sequence[TrafficState]) -> PhaseRecommendation:
        if not history:
            raise ValueError("history must contain at least one TrafficState")

        window = list(history)[-self._sequence_length :]
        if len(window) < self._sequence_length:
            # Left-pad by repeating the earliest observed state so a short
            # warm-up history still produces a well-formed window.
            window = [window[0]] * (self._sequence_length - len(window)) + window

        features = sequence_to_tensor(window)
        x = torch.from_numpy(features).unsqueeze(0)
        with torch.no_grad():
            logits = self._model(x)
            probs = F.softmax(logits, dim=-1).squeeze(0).numpy()

        phase_scores = {phase: float(p) for phase, p in zip(GREEN_PHASES, probs, strict=True)}
        best_phase = max(phase_scores, key=lambda phase: phase_scores[phase])
        return PhaseRecommendation(
            recommended_phase=best_phase,
            confidence=phase_scores[best_phase],
            phase_scores=phase_scores,
        )
