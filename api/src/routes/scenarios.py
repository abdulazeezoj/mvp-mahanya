"""GET /api/scenarios — scenario discovery and static network geometry."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

import mahanya.scenarios as scenario_catalog
from core.deps import SessionRegistry, get_registry, get_settings
from mahanya.config import Config
from mahanya.schemas import NetworkGeometry, Scenario
from mahanya.sumo.network_geometry import load_network_geometry

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@lru_cache(maxsize=8)
def _cached_network_geometry(net_path_str: str) -> NetworkGeometry:
    return load_network_geometry(Path(net_path_str))


@router.get("")
def list_scenarios(registry: SessionRegistry = Depends(get_registry)) -> list[Scenario]:
    return scenario_catalog.list_scenarios(registry.all_statuses())


@router.get("/{scenario_id}")
def get_scenario(scenario_id: str, registry: SessionRegistry = Depends(get_registry)) -> Scenario:
    if scenario_id not in scenario_catalog.SCENARIO_CATALOG:
        raise HTTPException(status_code=404, detail=f"unknown scenario {scenario_id!r}")
    return registry.get_or_create(scenario_id).scenario


@router.get("/{scenario_id}/network")
def get_network_geometry(
    scenario_id: str, settings: Config = Depends(get_settings)
) -> NetworkGeometry:
    if scenario_id not in scenario_catalog.SCENARIO_CATALOG:
        raise HTTPException(status_code=404, detail=f"unknown scenario {scenario_id!r}")
    return _cached_network_geometry(str(settings.simulation.net_path))
