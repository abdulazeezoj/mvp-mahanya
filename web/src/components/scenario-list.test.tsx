import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScenarioList } from "@/components/scenario-list";
import { makeScenario } from "@/lib/test-fixtures";

describe("ScenarioList", () => {
  it("renders a card per scenario with its status and seed", () => {
    const scenarios = [
      makeScenario({
        id: "sapon-peak",
        name: "Peak",
        status: "running",
        seed: 1001,
      }),
      makeScenario({
        id: "sapon-offpeak",
        name: "Off-peak",
        status: "idle",
        seed: 1002,
      }),
    ];
    render(
      <ScenarioList
        scenarios={scenarios}
        selectedId={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("Peak")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText("Seed 1001")).toBeInTheDocument();
    expect(screen.getByText("Off-peak")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("calls onSelect with the scenario id when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const scenarios = [makeScenario({ id: "sapon-peak", name: "Peak" })];
    render(
      <ScenarioList
        scenarios={scenarios}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText("Peak"));
    expect(onSelect).toHaveBeenCalledWith("sapon-peak");
  });
});
