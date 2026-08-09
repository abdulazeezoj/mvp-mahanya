"""Fit per-direction/period arrival-count distributions.

Poisson is the default first choice for independent, low-to-moderate-volume
arrivals; when the observed counts are overdispersed (variance well above
the mean — a common real-world departure from Poisson caused by clustered
arrivals), a negative binomial is fit instead. Each fit carries a
chi-square goodness-of-fit stat/p-value so the choice is auditable, not
just asserted.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel
from scipy import stats

from mahanya.schemas import ApproachDirection

DistributionFamily = Literal["poisson", "negative_binomial"]

#: Variance/mean ratio above which arrivals are treated as overdispersed
#: and fit with a negative binomial instead of a Poisson.
OVERDISPERSION_THRESHOLD = 1.5


class FitResult(BaseModel):
    direction: ApproachDirection
    period: str
    family: DistributionFamily
    params: dict[str, float]
    chi_square_stat: float
    chi_square_pvalue: float
    n_observations: int
    #: Mean arrivals per the raw counts' collection interval (5 minutes in
    #: the field-count CSV) — see `sumo.calibrate.mean_arrivals_per_hour`
    #: for the hourly conversion used to calibrate SUMO flows.
    mean_arrivals: float


def _chi_square_goodness_of_fit(counts: np.ndarray, pmf) -> tuple[float, float]:  # type: ignore[no-untyped-def]
    values, observed = np.unique(counts, return_counts=True)
    probs = np.clip(np.array([pmf(v) for v in values], dtype=float), 1e-9, None)
    expected = probs / probs.sum() * observed.sum()
    stat, pvalue = stats.chisquare(observed, expected)
    return float(stat), float(pvalue)


def fit_direction_period(counts: np.ndarray, direction: str, period: str) -> FitResult:
    """Fit one direction/period's arrival counts to Poisson or negative binomial."""

    counts = np.asarray(counts)
    if counts.size == 0:
        raise ValueError("no observations to fit")

    mean = float(counts.mean())
    variance = float(counts.var(ddof=1)) if counts.size > 1 else 0.0
    dispersion = variance / mean if mean > 0 else 1.0

    family: DistributionFamily
    if dispersion <= OVERDISPERSION_THRESHOLD or mean == 0:
        family = "poisson"
        params = {"lambda": mean}
        stat, pvalue = _chi_square_goodness_of_fit(counts, lambda v: stats.poisson.pmf(v, mean))
    else:
        family = "negative_binomial"
        p = mean / variance
        n = mean * p / (1 - p)
        params = {"n": float(n), "p": float(p)}
        stat, pvalue = _chi_square_goodness_of_fit(counts, lambda v: stats.nbinom.pmf(v, n, p))

    return FitResult(
        direction=direction,
        period=period,
        family=family,
        params=params,
        chi_square_stat=stat,
        chi_square_pvalue=pvalue,
        n_observations=int(counts.size),
        mean_arrivals=mean,
    )


def fit_all(df: pd.DataFrame) -> list[FitResult]:
    """Fit every (direction, period) group in a loaded field-count DataFrame."""

    results = []
    for (direction, period), group in df.groupby(["direction", "period"]):
        results.append(
            fit_direction_period(group["vehicle_count"].to_numpy(), str(direction), str(period))
        )
    return results


def save_fit_results(results: list[FitResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [r.model_dump(mode="json") for r in results]
    path.write_text(json.dumps(payload, indent=2))


def load_fit_results(path: Path) -> list[FitResult]:
    payload = json.loads(path.read_text())
    return [FitResult.model_validate(r) for r in payload]
