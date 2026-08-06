"""GET /api/scenarios — scenario discovery."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

import mahanya.scenarios as scenario_catalog
from core.deps import SessionRegistry, get_registry
from mahanya.schemas import Scenario

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("")
def list_scenarios(registry: SessionRegistry = Depends(get_registry)) -> list[Scenario]:
    return scenario_catalog.list_scenarios(registry.all_statuses())


@router.get("/{scenario_id}")
def get_scenario(scenario_id: str, registry: SessionRegistry = Depends(get_registry)) -> Scenario:
    if scenario_id not in scenario_catalog.SCENARIO_CATALOG:
        raise HTTPException(status_code=404, detail=f"unknown scenario {scenario_id!r}")
    return registry.get_or_create(scenario_id).scenario
