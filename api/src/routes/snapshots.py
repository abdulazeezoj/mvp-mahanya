"""GET /api/snapshots/*: current-state, decision-log, and evaluation queries."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from core.deps import SessionRegistry, get_model, get_registry, get_settings
from mahanya.config import Config
from mahanya.evaluation import FixedTimeController, MetricsCollector, run_scenario
from mahanya.model.infer import ModelRecommender
from mahanya.scenarios import SCENARIO_CATALOG, get_scenario_def
from mahanya.scheduler import Controller
from mahanya.schemas import EvaluationMetrics, SchedulerDecision, TrafficState
from mahanya.sumo.traci_client import TraciClient

router = APIRouter(prefix="/snapshots", tags=["snapshots"])

#: Ticks to run for an on-demand evaluation comparison: short enough to
#: answer within one HTTP request, long enough to be a meaningful sample.
EVALUATION_TICKS = 600


def _check_known(scenario_id: str) -> None:
    if scenario_id not in SCENARIO_CATALOG:
        raise HTTPException(status_code=404, detail=f"unknown scenario {scenario_id!r}")


@router.get("/{scenario_id}/state")
def get_state(
    scenario_id: str, registry: SessionRegistry = Depends(get_registry)
) -> TrafficState | None:
    _check_known(scenario_id)
    return registry.get_or_create(scenario_id).latest_state()


@router.get("/{scenario_id}/decision")
def get_decision(
    scenario_id: str, registry: SessionRegistry = Depends(get_registry)
) -> SchedulerDecision | None:
    _check_known(scenario_id)
    return registry.get_or_create(scenario_id).latest_decision()


@router.get("/{scenario_id}/decisions")
def get_decision_log(
    scenario_id: str,
    limit: int = Query(default=100, le=500),
    registry: SessionRegistry = Depends(get_registry),
) -> list[SchedulerDecision]:
    _check_known(scenario_id)
    return registry.get_or_create(scenario_id).decision_log(limit)


@router.get("/{scenario_id}/evaluation")
def get_evaluation(
    scenario_id: str,
    settings: Config = Depends(get_settings),
    model: ModelRecommender | None = Depends(get_model),
) -> list[EvaluationMetrics]:
    """Run a short head-to-head: intelligent controller vs. fixed-time
    baseline, on identical scenario conditions (same seed). Synchronous:
    FastAPI runs non-async routes in a threadpool, so this doesn't block
    other requests, but it does take a few seconds.
    """

    _check_known(scenario_id)
    scenario_def = get_scenario_def(scenario_id)
    sumocfg = settings.simulation.sumocfg_path_for(scenario_def.sumocfg_file)
    dt = settings.simulation.control_interval_sec

    intelligent_client = TraciClient(
        sumocfg,
        tls_id=settings.simulation.tls_id,
        seed=scenario_def.seed,
        step_length=settings.simulation.step_length_sec,
        sumo_binary=settings.simulation.sumo_binary,
        label=f"eval-intelligent-{scenario_id}-{id(settings)}",
    )
    intelligent_client.start()
    controller = Controller(
        settings.scheduler, dt=dt, model=model, sequence_length=settings.model.sequence_length
    )
    intelligent_collector = MetricsCollector(controller="intelligent", scenario_id=scenario_id)
    try:
        intelligent_metrics = run_scenario(
            intelligent_client,
            scenario_id,
            EVALUATION_TICKS,
            dt,
            lambda traffic: controller.step(traffic).applied_phase,
            intelligent_collector,
        )
    finally:
        intelligent_client.close()

    fixed_client = TraciClient(
        sumocfg,
        tls_id=settings.simulation.tls_id,
        seed=scenario_def.seed,
        step_length=settings.simulation.step_length_sec,
        sumo_binary=settings.simulation.sumo_binary,
        label=f"eval-fixed-{scenario_id}-{id(settings)}",
    )
    fixed_client.start()
    fixed_controller = FixedTimeController(
        green_sec=settings.scheduler.min_green_sec * 2,
        yellow_sec=settings.scheduler.yellow_sec,
        all_red_sec=settings.scheduler.all_red_sec,
    )
    fixed_collector = MetricsCollector(controller="fixed-time", scenario_id=scenario_id)
    try:
        fixed_metrics = run_scenario(
            fixed_client,
            scenario_id,
            EVALUATION_TICKS,
            dt,
            lambda _traffic: fixed_controller.step(dt),
            fixed_collector,
        )
    finally:
        fixed_client.close()

    return [intelligent_metrics, fixed_metrics]
