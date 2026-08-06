"""Generate a synthetic PLACEHOLDER field-count CSV for the Sapon Under-bridge
Junction, standing in until a real traffic count survey is conducted.

The output matches ``mahanya.data.ingest.RawCountRecord`` exactly, so
swapping in real field data later is a drop-in file replacement with no
code changes. Re-run with a different ``--seed`` to regenerate.
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

# Plausible per-5-minute arrival means for a busy Nigerian under-bridge
# junction: north/south are the through-directions on the main carriageway
# (higher volume), east/west are the side approaches (lower volume).
DIRECTION_PROFILES = {
    "north": {"peak": 9.5, "offpeak": 3.2},
    "south": {"peak": 10.2, "offpeak": 3.6},
    "east": {"peak": 5.8, "offpeak": 1.9},
    "west": {"peak": 6.4, "offpeak": 2.1},
}
INTERVAL_MINUTES = 5
INTERVALS_PER_SESSION = 12  # one hour per session, per period
PERIOD_START = {"peak": dt.time(7, 30), "offpeak": dt.time(13, 0)}
SESSION_DATES = [dt.date(2026, 3, 3), dt.date(2026, 3, 5), dt.date(2026, 3, 10)]


def generate(seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows: list[dict[str, object]] = []
    for session_date in SESSION_DATES:
        for direction, means in DIRECTION_PROFILES.items():
            for period, mean in means.items():
                start = dt.datetime.combine(session_date, PERIOD_START[period])
                for i in range(INTERVALS_PER_SESSION):
                    interval_start = (start + dt.timedelta(minutes=INTERVAL_MINUTES * i)).time()
                    count = int(rng.poisson(mean))
                    rows.append(
                        {
                            "session_date": session_date.isoformat(),
                            "direction": direction,
                            "period": period,
                            "interval_start": interval_start.strftime("%H:%M"),
                            "interval_minutes": INTERVAL_MINUTES,
                            "vehicle_count": count,
                        }
                    )
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "raw" / "sapon_traffic_counts.csv",
    )
    args = parser.parse_args()

    df = generate(args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"Wrote {len(df)} rows to {args.out}")


if __name__ == "__main__":
    main()
