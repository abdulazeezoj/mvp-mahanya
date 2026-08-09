import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApproachStateGrid } from "@/components/approach-state-grid";
import { makeApproach, makeTrafficState } from "@/lib/test-fixtures";

describe("ApproachStateGrid", () => {
  it("shows an empty-state message when there is no live state", () => {
    render(<ApproachStateGrid trafficState={null} />);
    expect(screen.getByText(/no live state yet/i)).toBeInTheDocument();
  });

  it("renders per-direction vehicle counts, queue, and waiting time", () => {
    const state = makeTrafficState({
      approaches: {
        north: makeApproach({
          vehicleCount: 5,
          queueLength: 2,
          waitingTimeSec: 12,
        }),
        south: makeApproach(),
        east: makeApproach(),
        west: makeApproach(),
      },
    });
    render(<ApproachStateGrid trafficState={state} />);
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/Queue: 2 · Waiting: 12s/)).toBeInTheDocument();
  });

  it("shows an EV badge only for approaches with an emergency vehicle", () => {
    const state = makeTrafficState({
      approaches: {
        north: makeApproach(),
        south: makeApproach(),
        east: makeApproach({ hasEmergencyVehicle: true }),
        west: makeApproach(),
      },
    });
    render(<ApproachStateGrid trafficState={state} />);
    expect(screen.getAllByText("EV")).toHaveLength(1);
  });
});
