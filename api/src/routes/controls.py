"""POST /api/controls/{scenario_id}/{run,pause,step,reset} — session lifecycle."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.deps import SessionRegistry, get_registry
from core.simulation import ScenarioSession
from mahanya.scenarios import SCENARIO_CATALOG
from mahanya.schemas import Scenario

router = APIRouter(prefix="/controls", tags=["controls"])


def _resolve(scenario_id: str, registry: SessionRegistry) -> ScenarioSession:
    if scenario_id not in SCENARIO_CATALOG:
        raise HTTPException(status_code=404, detail=f"unknown scenario {scenario_id!r}")
    return registry.get_or_create(scenario_id)


@router.post("/{scenario_id}/run")
def run(scenario_id: str, registry: SessionRegistry = Depends(get_registry)) -> Scenario:
    session = _resolve(scenario_id, registry)
    session.start()
    return session.scenario


@router.post("/{scenario_id}/pause")
def pause(scenario_id: str, registry: SessionRegistry = Depends(get_registry)) -> Scenario:
    session = _resolve(scenario_id, registry)
    session.pause()
    return session.scenario


@router.post("/{scenario_id}/step")
def step(scenario_id: str, registry: SessionRegistry = Depends(get_registry)) -> Scenario:
    session = _resolve(scenario_id, registry)
    session.step()
    return session.scenario


@router.post("/{scenario_id}/reset")
def reset(scenario_id: str, registry: SessionRegistry = Depends(get_registry)) -> Scenario:
    session = _resolve(scenario_id, registry)
    session.reset()
    return session.scenario
