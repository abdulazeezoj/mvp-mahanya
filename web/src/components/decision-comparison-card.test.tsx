import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionComparisonCard } from "@/components/decision-comparison-card";
import { makeDecision } from "@/lib/test-fixtures";

describe("DecisionComparisonCard", () => {
  it("shows an empty state when no decision has been recorded yet", () => {
    render(<DecisionComparisonCard decision={null} />);
    expect(screen.getByText(/no decision recorded yet/i)).toBeInTheDocument();
  });

  it("shows the model recommendation and applied phase when they match", () => {
    const decision = makeDecision({
      recommendation: { recommendedPhase: "NORTH_GREEN", confidence: 0.87 },
      appliedPhase: "NORTH_GREEN",
      reasonCode: "model_accepted",
    });
    render(<DecisionComparisonCard decision={decision} />);
    expect(screen.getAllByText("NORTH_GREEN")).toHaveLength(2);
    expect(screen.getByText("87% confidence")).toBeInTheDocument();
    expect(screen.getByText(/matched recommendation/i)).toBeInTheDocument();
  });

  it("labels the recommendation as bypassed and shows 'overridden' for an emergency pre-emption", () => {
    const decision = makeDecision({
      recommendation: null,
      appliedPhase: "EAST_GREEN",
      reasonCode: "emergency_preempt",
      reasonDetail: "Emergency vehicle detected on east approach",
    });
    render(<DecisionComparisonCard decision={decision} />);
    expect(
      screen.getByText(/bypassed \(emergency pre-emption\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/overridden/i)).toBeInTheDocument();
    expect(
      screen.getByText("Emergency vehicle detected on east approach"),
    ).toBeInTheDocument();
  });

  it("shows 'overridden' when the applied phase differs from the recommendation", () => {
    const decision = makeDecision({
      recommendation: { recommendedPhase: "EAST_GREEN", confidence: 0.6 },
      appliedPhase: "NORTH_GREEN",
      reasonCode: "min_green_hold",
    });
    render(<DecisionComparisonCard decision={decision} />);
    expect(screen.getByText(/overridden/i)).toBeInTheDocument();
  });
});
