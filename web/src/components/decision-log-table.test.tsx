import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DecisionLogTable } from "@/components/decision-log-table";
import { makeDecision } from "@/lib/test-fixtures";

describe("DecisionLogTable", () => {
  it("renders one row per decision", () => {
    const decisions = [makeDecision({ tick: 2 }), makeDecision({ tick: 1 })];
    render(<DecisionLogTable decisions={decisions} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders an em dash for a null (emergency short-circuit) recommendation", () => {
    const decisions = [
      makeDecision({ recommendation: null, reasonCode: "emergency_preempt" }),
    ];
    render(<DecisionLogTable decisions={decisions} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("filters by reason code", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const decisions = [
      makeDecision({ tick: 1, reasonCode: "model_accepted" }),
      makeDecision({ tick: 2, reasonCode: "emergency_preempt" }),
    ];
    render(<DecisionLogTable decisions={decisions} />);
    const table = screen.getByRole("table");

    expect(
      within(table).getAllByText(/model_accepted|emergency_preempt/),
    ).toHaveLength(2);

    await user.click(
      screen.getByRole("combobox", { name: /filter by reason/i }),
    );
    const option = await screen.findByRole("option", {
      name: "emergency_preempt",
    });
    await user.click(option);

    expect(within(table).queryByText("model_accepted")).not.toBeInTheDocument();
    expect(within(table).getByText("emergency_preempt")).toBeInTheDocument();
  });
});
