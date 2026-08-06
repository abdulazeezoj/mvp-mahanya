from __future__ import annotations

import pytest

from mahanya.config import SchedulerThresholds


@pytest.fixture
def thresholds() -> SchedulerThresholds:
    return SchedulerThresholds(
        min_green_sec=5.0,
        max_green_sec=20.0,
        yellow_sec=3.0,
        all_red_sec=2.0,
        anti_starvation_wait_sec=15.0,
    )
