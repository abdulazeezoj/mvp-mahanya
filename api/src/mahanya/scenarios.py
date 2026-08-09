"""Static catalog of discoverable, runnable SUMO scenarios.

Each entry names a calibrated `.sumocfg` under `sumo/network/` (see
`mahanya.sumo.calibrate`). Kept at the `mahanya` top level, not inside any
one submodule, since both `routes.scenarios` (discovery) and `core`'s
session manager (lifecycle) need it.
"""

from __future__ import annotations

from dataclasses import dataclass

from mahanya.schemas import Scenario, ScenarioStatus


@dataclass(frozen=True, slots=True)
class ScenarioDef:
    id: str
    name: str
    sumocfg_file: str
    seed: int


SCENARIO_CATALOG: dict[str, ScenarioDef] = {
    "sapon-peak": ScenarioDef(
        id="sapon-peak",
        name="Sapon Under-bridge — Peak Hour",
        sumocfg_file="sapon_peak.sumocfg",
        seed=1001,
    ),
    "sapon-offpeak": ScenarioDef(
        id="sapon-offpeak",
        name="Sapon Under-bridge — Off-Peak",
        sumocfg_file="sapon_offpeak.sumocfg",
        seed=1002,
    ),
}


def list_scenarios(status_by_id: dict[str, ScenarioStatus]) -> list[Scenario]:
    return [
        Scenario(
            id=definition.id,
            name=definition.name,
            status=status_by_id.get(definition.id, "idle"),
            seed=definition.seed,
        )
        for definition in SCENARIO_CATALOG.values()
    ]


def get_scenario_def(scenario_id: str) -> ScenarioDef:
    try:
        return SCENARIO_CATALOG[scenario_id]
    except KeyError:
        raise KeyError(f"unknown scenario_id {scenario_id!r}") from None
