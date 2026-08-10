import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JunctionSimulationView } from "@/components/junction-simulation-view";
import { makeNetworkGeometry, makeTrafficState } from "@/lib/test-fixtures";

describe("JunctionSimulationView", () => {
  it("shows a loading message while geometry hasn't arrived yet", () => {
    render(<JunctionSimulationView geometry={null} trafficState={null} />);
    expect(screen.getByText(/loading junction geometry/i)).toBeInTheDocument();
  });

  it("renders an accessible junction image region once geometry loads", () => {
    const geometry = makeNetworkGeometry();
    render(<JunctionSimulationView geometry={geometry} trafficState={null} />);
    expect(
      screen.getByRole("img", { name: /live junction simulation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/junction idle, no live traffic state/i),
    ).toBeInTheDocument();
  });

  it("exposes the live vehicle count and active phase to assistive tech, regardless of vehicle type mix", () => {
    const geometry = makeNetworkGeometry();
    const state = makeTrafficState({
      activePhase: "NORTH_GREEN",
      vehicles: [
        { vehicleId: "v1", x: 148, y: 200, angleDeg: 0, vehicleType: "car" },
        {
          vehicleId: "v2",
          x: 152,
          y: 180,
          angleDeg: 180,
          vehicleType: "emergency",
        },
        {
          vehicleId: "v3",
          x: 140,
          y: 190,
          angleDeg: 90,
          vehicleType: "motorcycle",
        },
        { vehicleId: "v4", x: 160, y: 170, angleDeg: 270, vehicleType: "bus" },
        { vehicleId: "v5", x: 130, y: 210, angleDeg: 45, vehicleType: "truck" },
      ],
    });
    render(<JunctionSimulationView geometry={geometry} trafficState={state} />);
    expect(
      screen.getByText(/5 vehicles on the junction, active phase NORTH_GREEN/i),
    ).toBeInTheDocument();
  });

  it("announces which approach has an emergency vehicle to assistive tech", () => {
    const geometry = makeNetworkGeometry();
    const state = makeTrafficState({
      activePhase: "NORTH_GREEN",
      approaches: {
        north: makeTrafficState().approaches.north,
        south: {
          vehicleCount: 1,
          queueLength: 1,
          waitingTimeSec: 4,
          hasEmergencyVehicle: true,
        },
        east: makeTrafficState().approaches.east,
        west: makeTrafficState().approaches.west,
      },
      vehicles: [
        {
          vehicleId: "v1",
          x: 150,
          y: 50,
          angleDeg: 0,
          vehicleType: "emergency",
        },
      ],
    });
    render(<JunctionSimulationView geometry={geometry} trafficState={state} />);
    expect(
      screen.getByText(/emergency vehicle present on South/i),
    ).toBeInTheDocument();
  });

  it("renders a legend entry for every vehicle type", () => {
    const geometry = makeNetworkGeometry();
    render(<JunctionSimulationView geometry={geometry} trafficState={null} />);
    for (const label of [
      "Car",
      "Motorcycle",
      "Bus",
      "Truck",
      "Emergency vehicle",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
