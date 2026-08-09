"""A lightweight `nn.TransformerEncoder` phase recommender.

Small by design — the synopsis specifically calls for a "lightweight"
encoder, not a large sequence model: a handful of layers/heads over an
engineered per-timestep feature vector (see `features.py`), following the
pattern in Zhao et al. (2024) (cited in ARCHITECTURE.md).
"""

from __future__ import annotations

import math

import torch
from torch import nn

from mahanya.config import ModelConfig
from mahanya.model.features import FEATURE_DIM
from mahanya.schemas import GREEN_PHASES


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int) -> None:
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term[: pe[:, 1::2].shape[1]])
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        pe: torch.Tensor = self.pe  # type: ignore[assignment]
        return x + pe[:, : x.size(1)]


class PhaseTransformer(nn.Module):
    """Maps a window of engineered traffic-state features to logits over the
    four candidate green phases (`mahanya.schemas.GREEN_PHASES`)."""

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.config = config
        self.input_proj = nn.Linear(FEATURE_DIM, config.d_model)
        self.positional = PositionalEncoding(config.d_model, max_len=config.sequence_length)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=config.d_model,
            nhead=config.n_heads,
            dim_feedforward=config.dim_feedforward,
            dropout=config.dropout,
            batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=config.n_layers)
        self.classifier = nn.Linear(config.d_model, len(GREEN_PHASES))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (batch, seq_len, FEATURE_DIM) -> logits (batch, len(GREEN_PHASES))."""

        h = self.input_proj(x)
        h = self.positional(h)
        h = self.encoder(h)
        pooled = h[:, -1, :]
        logits: torch.Tensor = self.classifier(pooled)
        return logits
