"""Tests for `data.ingest` and `data.distribution_fit`."""

from __future__ import annotations

import numpy as np
import pytest
from pydantic import ValidationError

from mahanya.data.distribution_fit import fit_direction_period, load_fit_results, save_fit_results
from mahanya.data.ingest import load_raw_counts


def test_fit_direction_period_picks_poisson_for_low_dispersion():
    rng = np.random.default_rng(0)
    counts = rng.poisson(lam=6.0, size=200)  # variance ~= mean for Poisson
    result = fit_direction_period(counts, "north", "peak")
    assert result.family == "poisson"
    assert result.params["lambda"] == pytest.approx(counts.mean())
    assert result.n_observations == 200


def test_fit_direction_period_picks_negative_binomial_for_overdispersion():
    rng = np.random.default_rng(0)
    # Negative binomial with variance well above the mean.
    counts = rng.negative_binomial(n=2, p=0.15, size=200)
    result = fit_direction_period(counts, "south", "peak")
    assert result.family == "negative_binomial"
    assert "n" in result.params
    assert "p" in result.params


def test_fit_direction_period_rejects_empty_input():
    with pytest.raises(ValueError, match="no observations"):
        fit_direction_period(np.array([]), "east", "offpeak")


def test_save_and_load_fit_results_roundtrip(tmp_path):
    rng = np.random.default_rng(1)
    counts = rng.poisson(lam=4.0, size=100)
    result = fit_direction_period(counts, "west", "offpeak")

    path = tmp_path / "calibration.json"
    save_fit_results([result], path)
    loaded = load_fit_results(path)

    assert len(loaded) == 1
    assert loaded[0] == result


def test_load_raw_counts_valid_csv(tmp_path):
    csv_path = tmp_path / "counts.csv"
    csv_path.write_text(
        "session_date,direction,period,interval_start,interval_minutes,vehicle_count\n"
        "2026-03-03,north,peak,07:30,5,12\n"
        "2026-03-03,south,peak,07:30,5,14\n"
    )
    df = load_raw_counts(csv_path)
    assert len(df) == 2
    assert set(df["direction"]) == {"north", "south"}


def test_load_raw_counts_missing_column_raises(tmp_path):
    csv_path = tmp_path / "counts.csv"
    csv_path.write_text(
        "direction,period,interval_start,interval_minutes,vehicle_count\nnorth,peak,07:30,5,12\n"
    )
    with pytest.raises(ValueError, match="missing columns"):
        load_raw_counts(csv_path)


def test_load_raw_counts_rejects_invalid_direction(tmp_path):
    csv_path = tmp_path / "counts.csv"
    csv_path.write_text(
        "session_date,direction,period,interval_start,interval_minutes,vehicle_count\n"
        "2026-03-03,northeast,peak,07:30,5,12\n"
    )
    with pytest.raises(ValidationError):
        load_raw_counts(csv_path)
