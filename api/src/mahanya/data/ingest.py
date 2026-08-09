"""Load and validate raw field traffic-count CSVs.

Kept deliberately dumb: read the CSV, check the required columns are
present, and validate every ``direction`` value against the same
``ApproachDirection`` literal the rest of the codebase uses, so a typo'd
direction in a field-collected CSV fails loudly at ingest time rather than
silently producing an empty fit downstream.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from pydantic import TypeAdapter

from mahanya.schemas import ApproachDirection

REQUIRED_COLUMNS = {
    "session_date",
    "direction",
    "period",
    "interval_start",
    "interval_minutes",
    "vehicle_count",
}

_direction_adapter: TypeAdapter[ApproachDirection] = TypeAdapter(ApproachDirection)


def load_raw_counts(csv_path: Path) -> pd.DataFrame:
    """Load a field-count CSV, validating its shape and direction values."""

    df = pd.read_csv(csv_path)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")

    for value in df["direction"]:
        _direction_adapter.validate_python(value)

    return df
