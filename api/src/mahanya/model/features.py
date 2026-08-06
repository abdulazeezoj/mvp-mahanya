"""Per-timestep feature engineering: TrafficState -> a fixed-size numeric vector.

Both live inference (from a `TrafficState`) and offline training (from a
flattened Parquet row produced by `mahanya.data.sequence_gen`) build the
identical vector layout, via a single shared assembly routine, so training
and inference can never silently drift apart.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np
import pandas as pd

from mahanya.schemas import ALL_PHASES, Phase, TrafficState

DIRECTIONS: tuple[str, ...] = ("north", "south", "east", "west")
FEATURES_PER_DIRECTION = 4  # vehicle_count, queue_length, waiting_time_sec, has_emergency
PHASE_ONE_HOT_DIM = len(ALL_PHASES)
FEATURE_DIM = FEATURES_PER_DIRECTION * len(DIRECTIONS) + PHASE_ONE_HOT_DIM + 1

# Fixed normalization scales — a documented simplification pending a fitted
# scaler from real production traffic-volume statistics.
VEHICLE_COUNT_SCALE = 30.0
QUEUE_LENGTH_SCALE = 20.0
WAITING_TIME_SCALE = 120.0
ELAPSED_PHASE_TIME_SCALE = 120.0

PHASE_INDEX: dict[Phase, int] = {phase: i for i, phase in enumerate(ALL_PHASES)}


def _assemble(
    per_direction: Sequence[tuple[float, float, float, bool]],
    active_phase: Phase,
    elapsed_phase_time_sec: float,
) -> np.ndarray:
    features = np.zeros(FEATURE_DIM, dtype=np.float32)
    offset = 0
    for vehicle_count, queue_length, waiting_time_sec, has_emergency in per_direction:
        features[offset + 0] = vehicle_count / VEHICLE_COUNT_SCALE
        features[offset + 1] = queue_length / QUEUE_LENGTH_SCALE
        features[offset + 2] = waiting_time_sec / WAITING_TIME_SCALE
        features[offset + 3] = 1.0 if has_emergency else 0.0
        offset += FEATURES_PER_DIRECTION
    features[offset + PHASE_INDEX[active_phase]] = 1.0
    offset += PHASE_ONE_HOT_DIM
    features[offset] = elapsed_phase_time_sec / ELAPSED_PHASE_TIME_SCALE
    return features


def traffic_state_to_features(state: TrafficState) -> np.ndarray:
    per_direction = [
        (
            approach.vehicle_count,
            approach.queue_length,
            approach.waiting_time_sec,
            approach.has_emergency_vehicle,
        )
        for _, approach in state.approaches.items()
    ]
    return _assemble(per_direction, state.active_phase, state.elapsed_phase_time_sec)


def features_from_row(row: Mapping[str, object] | pd.Series) -> np.ndarray:
    """Build the same feature vector from a flattened sequence_gen Parquet row."""

    per_direction = [
        (
            float(row[f"{direction}_vehicle_count"]),  # type: ignore[arg-type]
            float(row[f"{direction}_queue_length"]),  # type: ignore[arg-type]
            float(row[f"{direction}_waiting_time_sec"]),  # type: ignore[arg-type]
            bool(row[f"{direction}_has_emergency_vehicle"]),
        )
        for direction in DIRECTIONS
    ]
    return _assemble(
        per_direction,
        row["active_phase"],  # type: ignore[arg-type]
        float(row["elapsed_phase_time_sec"]),  # type: ignore[arg-type]
    )


def sequence_to_tensor(states: Sequence[TrafficState]) -> np.ndarray:
    """Stack a window of TrafficState into a (seq_len, FEATURE_DIM) array."""

    return np.stack([traffic_state_to_features(s) for s in states])
