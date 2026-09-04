"""Supervised training loop for `PhaseTransformer`, from labelled Parquet sequences."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset, random_split

from mahanya.config import ModelConfig
from mahanya.model.features import features_from_row
from mahanya.model.transformer import PhaseTransformer
from mahanya.schemas import GREEN_PHASES

GREEN_INDEX: dict[str, int] = {phase: i for i, phase in enumerate(GREEN_PHASES)}


class SequenceDataset(Dataset[tuple[torch.Tensor, torch.Tensor]]):
    """Sliding windows of engineered features, labelled with the next
    applied green phase, skipping windows that end mid-transition, since
    yellow/all-red states are deterministic, not something to predict."""

    def __init__(self, df: pd.DataFrame, sequence_length: int) -> None:
        self._windows: list[tuple[np.ndarray, int]] = []
        for _, group in df.groupby("scenario_id"):
            ordered = group.sort_values("tick").reset_index(drop=True)
            features = np.stack([features_from_row(row) for _, row in ordered.iterrows()])
            for end in range(sequence_length, len(ordered)):
                label_phase = str(ordered.loc[end, "applied_phase"])
                if label_phase not in GREEN_INDEX:
                    continue
                window = features[end - sequence_length : end]
                self._windows.append((window, GREEN_INDEX[label_phase]))

    def __len__(self) -> int:
        return len(self._windows)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        window, label = self._windows[idx]
        return torch.from_numpy(window), torch.tensor(label, dtype=torch.long)


@dataclass(frozen=True, slots=True)
class TrainResult:
    epochs: int
    num_train_windows: int
    num_val_windows: int
    final_train_loss: float
    final_val_loss: float
    final_val_accuracy: float


def train(
    sequences_path: Path,
    model_config: ModelConfig,
    epochs: int = 10,
    batch_size: int = 32,
    lr: float = 1e-3,
    val_fraction: float = 0.2,
    seed: int = 0,
) -> TrainResult:
    df = pd.read_parquet(sequences_path)
    dataset = SequenceDataset(df, model_config.sequence_length)
    if len(dataset) < 10:
        raise ValueError(
            f"only {len(dataset)} labelled windows available in {sequences_path}; "
            "generate more sequences first"
        )

    generator = torch.Generator().manual_seed(seed)
    val_size = max(1, int(len(dataset) * val_fraction))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size], generator=generator)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    model = PhaseTransformer(model_config)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    final_train_loss = float("nan")
    final_val_loss = float("nan")
    final_val_accuracy = float("nan")

    for _epoch in range(epochs):
        model.train()
        train_losses = []
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            train_losses.append(loss.item())
        final_train_loss = float(np.mean(train_losses)) if train_losses else float("nan")

        model.eval()
        val_losses = []
        correct = 0
        total = 0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                logits = model(batch_x)
                loss = criterion(logits, batch_y)
                val_losses.append(loss.item())
                predicted = logits.argmax(dim=-1)
                correct += int((predicted == batch_y).sum().item())
                total += int(batch_y.size(0))
        final_val_loss = float(np.mean(val_losses)) if val_losses else float("nan")
        final_val_accuracy = correct / total if total else float("nan")

    model_config.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {"model_state_dict": model.state_dict(), "config": model_config.model_dump(mode="json")},
        model_config.checkpoint_path,
    )

    return TrainResult(
        epochs=epochs,
        num_train_windows=len(train_ds),
        num_val_windows=len(val_ds),
        final_train_loss=final_train_loss,
        final_val_loss=final_val_loss,
        final_val_accuracy=final_val_accuracy,
    )
