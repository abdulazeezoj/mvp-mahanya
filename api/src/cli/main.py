"""MaHanya CLI: fit, calibrate, generate, train, run, evaluate, serve-api, build-web.

Exposed as a console script via `api/pyproject.toml`'s `[project.scripts]`,
pointing at `cli.main:app`; implementation stays here, packaging metadata
stays in `pyproject.toml`.
"""

from __future__ import annotations

import json
import subprocess
from collections import Counter
from pathlib import Path

import typer
import uvicorn
from rich.console import Console

from mahanya.config import get_config
from mahanya.data.distribution_fit import fit_all, load_fit_results, save_fit_results
from mahanya.data.ingest import load_raw_counts
from mahanya.data.sequence_gen import generate_sequences
from mahanya.evaluation import FixedTimeController, MetricsCollector, run_scenario
from mahanya.model.infer import ModelRecommender
from mahanya.model.train import train as train_model
from mahanya.scenarios import get_scenario_def
from mahanya.scheduler import Controller
from mahanya.sumo.calibrate import generate_routes, write_sumocfg
from mahanya.sumo.traci_client import TraciClient

app = typer.Typer(help="MaHanya: priority-aware intelligent traffic control pipeline.")
console = Console()

#: api/src/cli/main.py -> parents[3] is the repo root (api/ is parents[2]).
REPO_ROOT = Path(__file__).resolve().parents[3]


@app.command()
def fit(
    raw_csv: Path | None = typer.Option(None, help="Defaults to config.raw_counts_csv"),
    output: Path | None = typer.Option(None, help="Defaults to data/processed/calibration.json"),
) -> None:
    """Fit per-direction/period arrival distributions from raw field counts."""

    cfg = get_config()
    raw_csv = raw_csv or cfg.raw_counts_csv
    output = output or (cfg.data_dir / "processed" / "calibration.json")

    df = load_raw_counts(raw_csv)
    results = fit_all(df)
    save_fit_results(results, output)
    for r in results:
        console.print(
            f"{r.direction}/{r.period}: {r.family} {r.params} "
            f"(p={r.chi_square_pvalue:.3f}, n={r.n_observations})"
        )
    console.print(f"Saved {len(results)} fits to {output}")


@app.command()
def calibrate(
    period: str = typer.Option(..., help="peak or offpeak"),
    duration_sec: int = typer.Option(1800),
    fit_results_path: Path | None = typer.Option(None),
) -> None:
    """Generate a calibrated .rou.xml + .sumocfg for one period."""

    cfg = get_config()
    fit_results_path = fit_results_path or (cfg.data_dir / "processed" / "calibration.json")
    fits = load_fit_results(fit_results_path)

    net_dir = cfg.simulation.network_dir
    route_name = f"sapon_{period}.rou.xml"
    sumocfg_name = f"sapon_{period}.sumocfg"
    generate_routes(
        fits, period=period, duration_sec=duration_sec, output_path=net_dir / route_name
    )
    write_sumocfg(
        cfg.simulation.net_file, route_name, net_dir / sumocfg_name, duration_sec=duration_sec
    )
    console.print(f"Wrote {net_dir / route_name} and {net_dir / sumocfg_name}")


@app.command()
def generate(
    scenario_id: str = typer.Option("sapon-peak"),
    num_ticks: int = typer.Option(1200),
    seed: int = typer.Option(0),
    output: Path | None = typer.Option(None),
) -> None:
    """Generate labelled training sequences from a calibrated scenario."""

    cfg = get_config()
    output = output or cfg.sequences_path
    scenario_def = get_scenario_def(scenario_id)
    sumocfg = cfg.simulation.sumocfg_path_for(scenario_def.sumocfg_file)

    n = generate_sequences(
        sumocfg,
        scenario_id,
        num_ticks,
        cfg.scheduler,
        cfg.simulation.control_interval_sec,
        seed,
        output,
    )
    console.print(f"Wrote {n} rows to {output}")


@app.command()
def train(
    sequences_path: Path | None = typer.Option(None),
    epochs: int = typer.Option(10),
    batch_size: int = typer.Option(32),
    lr: float = typer.Option(1e-3),
) -> None:
    """Train the transformer phase recommender."""

    cfg = get_config()
    sequences_path = sequences_path or cfg.sequences_path
    result = train_model(sequences_path, cfg.model, epochs=epochs, batch_size=batch_size, lr=lr)
    console.print(result)
    console.print(f"Saved checkpoint to {cfg.model.checkpoint_path}")


@app.command()
def run(
    scenario_id: str = typer.Option("sapon-peak"),
    num_ticks: int = typer.Option(600),
    seed: int | None = typer.Option(None),
    use_model: bool = typer.Option(True),
    gui: bool = typer.Option(False),
) -> None:
    """Run one scenario end-to-end through the control loop."""

    cfg = get_config()
    scenario_def = get_scenario_def(scenario_id)
    sumocfg = cfg.simulation.sumocfg_path_for(scenario_def.sumocfg_file)

    model = None
    if use_model and cfg.model.checkpoint_path.exists():
        model = ModelRecommender.load(cfg.model.checkpoint_path, cfg.model)

    client = TraciClient(
        sumocfg,
        tls_id=cfg.simulation.tls_id,
        seed=seed if seed is not None else scenario_def.seed,
        step_length=cfg.simulation.step_length_sec,
        sumo_binary=cfg.simulation.sumo_binary,
        gui=gui,
    )
    client.start()
    controller = Controller(
        cfg.scheduler,
        dt=cfg.simulation.control_interval_sec,
        model=model,
        sequence_length=cfg.model.sequence_length,
        decision_log_path=cfg.dashboard.decision_log_path,
    )
    try:
        decisions = controller.run(client, scenario_id, num_ticks)
    finally:
        client.close()

    console.print(dict(Counter(d.reason_code for d in decisions)))


@app.command()
def evaluate(
    scenario_id: str = typer.Option("sapon-peak"),
    num_ticks: int = typer.Option(600),
    output: Path | None = typer.Option(None),
) -> None:
    """Evaluate the intelligent controller against the fixed-time baseline."""

    cfg = get_config()
    output = output or (cfg.data_dir / "processed" / f"evaluation_{scenario_id}.json")
    scenario_def = get_scenario_def(scenario_id)
    sumocfg = cfg.simulation.sumocfg_path_for(scenario_def.sumocfg_file)
    dt = cfg.simulation.control_interval_sec

    model = None
    if cfg.model.checkpoint_path.exists():
        model = ModelRecommender.load(cfg.model.checkpoint_path, cfg.model)

    intelligent_client = TraciClient(
        sumocfg,
        tls_id=cfg.simulation.tls_id,
        seed=scenario_def.seed,
        step_length=cfg.simulation.step_length_sec,
        sumo_binary=cfg.simulation.sumo_binary,
        label=f"cli-eval-intelligent-{scenario_id}",
    )
    intelligent_client.start()
    controller = Controller(
        cfg.scheduler, dt=dt, model=model, sequence_length=cfg.model.sequence_length
    )
    intelligent_collector = MetricsCollector(controller="intelligent", scenario_id=scenario_id)
    try:
        intelligent_metrics = run_scenario(
            intelligent_client,
            scenario_id,
            num_ticks,
            dt,
            lambda traffic: controller.step(traffic).applied_phase,
            intelligent_collector,
        )
    finally:
        intelligent_client.close()

    fixed_client = TraciClient(
        sumocfg,
        tls_id=cfg.simulation.tls_id,
        seed=scenario_def.seed,
        step_length=cfg.simulation.step_length_sec,
        sumo_binary=cfg.simulation.sumo_binary,
        label=f"cli-eval-fixed-{scenario_id}",
    )
    fixed_client.start()
    fixed_controller = FixedTimeController(
        green_sec=cfg.scheduler.min_green_sec * 2,
        yellow_sec=cfg.scheduler.yellow_sec,
        all_red_sec=cfg.scheduler.all_red_sec,
    )
    fixed_collector = MetricsCollector(controller="fixed-time", scenario_id=scenario_id)
    try:
        fixed_metrics = run_scenario(
            fixed_client,
            scenario_id,
            num_ticks,
            dt,
            lambda _traffic: fixed_controller.step(dt),
            fixed_collector,
        )
    finally:
        fixed_client.close()

    output.parent.mkdir(parents=True, exist_ok=True)
    metrics = (intelligent_metrics, fixed_metrics)
    payload = [m.model_dump(mode="json", by_alias=True) for m in metrics]
    output.write_text(json.dumps(payload, indent=2))
    console.print(intelligent_metrics)
    console.print(fixed_metrics)
    console.print(f"Saved to {output}")


@app.command("serve-api")
def serve_api(
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8000),
    reload: bool = typer.Option(False),
) -> None:
    """Run the internal FastAPI relay (serves /api/* for the dashboard)."""

    uvicorn.run("core.app:app", host=host, port=port, reload=reload)


@app.command("build-web")
def build_web() -> None:
    """Build the Next.js SPA static export: the one command crossing the api/web boundary."""

    web_dir = REPO_ROOT / "web"
    if not web_dir.exists():
        console.print(f"[red]web/ not found at {web_dir}[/red]")
        raise typer.Exit(code=1)
    subprocess.run(["pnpm", "run", "build"], cwd=web_dir, check=True)


if __name__ == "__main__":
    app()
