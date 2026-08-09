import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JunctionSummaryCards } from "@/components/junction-summary-cards";
import {
  makeApproach,
  makeDecision,
  makeTrafficState,
} from "@/lib/test-fixtures";

describe("JunctionSummaryCards", () => {
  it("shows placeholders when nothing has run yet", () => {
    render(<JunctionSummaryCards trafficState={null} decision={null} />);
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("No live state yet")).toBeInTheDocument();
    expect(screen.getByText("No override detail")).toBeInTheDocument();
  });

  it("sums queue length across all four approaches", () => {
    const state = makeTrafficState({
      approaches: {
        north: makeApproach({ queueLength: 3 }),
        south: makeApproach({ queueLength: 2 }),
        east: makeApproach({ queueLength: 1 }),
        west: makeApproach({ queueLength: 0 }),
      },
    });
    render(<JunctionSummaryCards trafficState={state} decision={null} />);
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("flags emergency presence when any approach has one", () => {
    const state = makeTrafficState({
      approaches: {
        north: makeApproach(),
        south: makeApproach({ hasEmergencyVehicle: true }),
        east: makeApproach(),
        west: makeApproach(),
      },
    });
    render(<JunctionSummaryCards trafficState={state} decision={null} />);
    expect(screen.getByText("Detected")).toBeInTheDocument();
  });

  it("shows the human-readable label for the last reason code", () => {
    const decision = makeDecision({ reasonCode: "anti_starvation_force" });
    render(<JunctionSummaryCards trafficState={null} decision={decision} />);
    expect(screen.getByText("Anti-starvation")).toBeInTheDocument();
  });
});
