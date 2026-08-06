import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JunctionSimulationView } from "@/components/junction-simulation-view";
import { makeNetworkGeometry, makeTrafficState } from "@/lib/test-fixtures";

describe("JunctionSimulationView", () => {
  it("shows a loading message while geometry hasn't arrived yet", () => {
    render(<JunctionSimulationView geometry={null} trafficState={null} />);
    expect(screen.getByText(/loading junction geometry/i)).toBeInTheDocument();
  });

  it("renders one road polyline per lane once geometry loads", () => {
    const geometry = makeNetworkGeometry();
    render(<JunctionSimulationView geometry={geometry} trafficState={null} />);
    const svg = screen.getByRole("img", { name: /live junction simulation/i });
    expect(svg.querySelectorAll("polyline")).toHaveLength(
      geometry.lanes.length,
    );
  });

  it("renders one marker per live vehicle", () => {
    const geometry = makeNetworkGeometry();
    const state = makeTrafficState({
      activePhase: "NORTH_GREEN",
      vehicles: [
        { vehicleId: "v1", x: 148, y: 200, angleDeg: 0, isEmergency: false },
        { vehicleId: "v2", x: 152, y: 180, angleDeg: 180, isEmergency: true },
      ],
    });
    render(<JunctionSimulationView geometry={geometry} trafficState={state} />);
    const svg = screen.getByRole("img", { name: /live junction simulation/i });
    expect(svg.querySelectorAll("polygon")).toHaveLength(2);
  });
});
