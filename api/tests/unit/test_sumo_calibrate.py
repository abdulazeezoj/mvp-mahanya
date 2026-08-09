"""Tests for `sumo.calibrate`'s route/sumocfg XML generation — pure XML
writing, no SUMO process required.
"""

from __future__ import annotations

from xml.etree import ElementTree as ET

import pytest

from mahanya.data.distribution_fit import FitResult
from mahanya.sumo.calibrate import (
    VEHICLE_TYPE_MIX,
    generate_routes,
    mean_arrivals_per_hour,
    write_sumocfg,
)


@pytest.fixture
def fit_results() -> list[FitResult]:
    directions = ["north", "south", "east", "west"]
    return [
        FitResult(
            direction=d,
            period=period,
            family="poisson",
            params={"lambda": 4.0},
            chi_square_stat=1.0,
            chi_square_pvalue=0.5,
            n_observations=30,
            mean_arrivals=4.0,
        )
        for d in directions
        for period in ("peak", "offpeak")
    ]


def test_mean_arrivals_per_hour_converts_5min_mean_to_hourly():
    fit = FitResult(
        direction="north",
        period="peak",
        family="poisson",
        params={"lambda": 5.0},
        chi_square_stat=0.0,
        chi_square_pvalue=1.0,
        n_observations=10,
        mean_arrivals=5.0,
    )
    assert mean_arrivals_per_hour(fit) == 60.0


def test_generate_routes_writes_one_flow_pair_per_direction(fit_results, tmp_path):
    output = tmp_path / "sapon_peak.rou.xml"
    generate_routes(fit_results, period="peak", duration_sec=600, output_path=output)

    root = ET.parse(output).getroot()
    flows = root.findall("flow")
    assert len(flows) == 8  # 4 directions x (civilian + emergency)
    civilian_flow_ids = {f.get("id") for f in flows if f.get("type") == "civilian"}
    assert civilian_flow_ids == {
        f"{d}_civilian_flow" for d in ("north", "south", "east", "west")
    }
    emergency_flow_ids = {f.get("id") for f in flows if f.get("type") == "emergency"}
    assert emergency_flow_ids == {f"{d}_emergency_flow" for d in ("north", "south", "east", "west")}
    for flow in flows:
        assert "period" in flow.attrib
        assert flow.get("period", "").startswith("exp(")

    vtype_distributions = root.findall("vTypeDistribution")
    assert len(vtype_distributions) == 1
    assert vtype_distributions[0].get("id") == "civilian"
    assert set(vtype_distributions[0].get("vTypes", "").split()) == set(VEHICLE_TYPE_MIX)


def test_generate_routes_without_emergency_flows(fit_results, tmp_path):
    output = tmp_path / "sapon_peak_no_emergency.rou.xml"
    generate_routes(
        fit_results, period="peak", duration_sec=600, output_path=output, include_emergency=False
    )
    root = ET.parse(output).getroot()
    flows = root.findall("flow")
    assert len(flows) == 4
    assert all(f.get("type") == "civilian" for f in flows)


def test_generate_routes_missing_period_raises(fit_results, tmp_path):
    output = tmp_path / "missing.rou.xml"
    with pytest.raises(ValueError, match="no fit results"):
        generate_routes(fit_results, period="wet-weather", duration_sec=600, output_path=output)


def test_write_sumocfg_references_net_and_route_files(tmp_path):
    output = tmp_path / "sapon_peak.sumocfg"
    write_sumocfg("sapon.net.xml", "sapon_peak.rou.xml", output, duration_sec=1800)

    root = ET.parse(output).getroot()
    net_file = root.find("./input/net-file")
    route_files = root.find("./input/route-files")
    end_time = root.find("./time/end")
    assert net_file is not None and net_file.get("value") == "sapon.net.xml"
    assert route_files is not None and route_files.get("value") == "sapon_peak.rou.xml"
    assert end_time is not None and end_time.get("value") == "1800"
