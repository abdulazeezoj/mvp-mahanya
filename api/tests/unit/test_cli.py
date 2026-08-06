"""Smoke tests for the Typer CLI's non-SUMO subcommands (`fit`, `calibrate`).

`generate`/`train`/`run`/`evaluate`/`serve-api` all require a real SUMO
process or a trained model and are exercised in
tests/integration/test_control_loop_sumo.py and by hand instead, to keep
this suite fast.
"""

from __future__ import annotations

from typer.testing import CliRunner

from cli.main import app

runner = CliRunner()


def test_fit_command_writes_calibration_json(tmp_path):
    raw_csv = tmp_path / "counts.csv"
    raw_csv.write_text(
        "session_date,direction,period,interval_start,interval_minutes,vehicle_count\n"
        "2026-03-03,north,peak,07:30,5,12\n"
        "2026-03-03,north,peak,07:35,5,9\n"
        "2026-03-03,north,peak,07:40,5,11\n"
        "2026-03-03,south,peak,07:30,5,14\n"
        "2026-03-03,south,peak,07:35,5,13\n"
        "2026-03-03,south,peak,07:40,5,15\n"
        "2026-03-03,east,peak,07:30,5,4\n"
        "2026-03-03,east,peak,07:35,5,6\n"
        "2026-03-03,east,peak,07:40,5,5\n"
        "2026-03-03,west,peak,07:30,5,5\n"
        "2026-03-03,west,peak,07:35,5,7\n"
        "2026-03-03,west,peak,07:40,5,6\n"
    )
    output = tmp_path / "calibration.json"

    result = runner.invoke(app, ["fit", "--raw-csv", str(raw_csv), "--output", str(output)])
    assert result.exit_code == 0, result.output
    assert output.exists()
    assert "Saved 4 fits" in result.output


def test_calibrate_command_writes_route_and_sumocfg(tmp_path, monkeypatch):
    fit_results_path = tmp_path / "calibration.json"
    from mahanya.data.distribution_fit import FitResult, save_fit_results

    results = [
        FitResult(
            direction=d,
            period="peak",
            family="poisson",
            params={"lambda": 4.0},
            chi_square_stat=0.0,
            chi_square_pvalue=1.0,
            n_observations=10,
            mean_arrivals=4.0,
        )
        for d in ("north", "south", "east", "west")
    ]
    save_fit_results(results, fit_results_path)

    network_dir = tmp_path / "network"
    network_dir.mkdir()
    monkeypatch.setenv("MAHANYA_SIMULATION__NETWORK_DIR", str(network_dir))

    result = runner.invoke(
        app,
        [
            "calibrate",
            "--period",
            "peak",
            "--duration-sec",
            "600",
            "--fit-results-path",
            str(fit_results_path),
        ],
    )
    assert result.exit_code == 0, result.output
