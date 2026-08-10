import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScenarioPicker } from "@/components/scenario-list";
import { makeScenario } from "@/lib/test-fixtures";

describe("ScenarioPicker", () => {
  it("shows a placeholder when no scenario is selected", () => {
    render(
      <ScenarioPicker scenarios={[]} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText("Select a scenario")).toBeInTheDocument();
  });

  it("shows the selected scenario's name and status in the trigger", () => {
    const scenarios = [
      makeScenario({ id: "sapon-peak", name: "Peak", status: "running" }),
      makeScenario({ id: "sapon-offpeak", name: "Off-peak", status: "idle" }),
    ];
    render(
      <ScenarioPicker
        scenarios={scenarios}
        selectedId="sapon-peak"
        onSelect={() => {}}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /select scenario/i });
    expect(trigger).toHaveTextContent("Peak");
    expect(trigger).toHaveTextContent("running");
  });

  it("lists every scenario with its seed and status when opened, and calls onSelect when one is chosen", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onSelect = vi.fn();
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
      <ScenarioPicker
        scenarios={scenarios}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    await user.click(
      screen.getByRole("combobox", { name: /select scenario/i }),
    );
    expect(await screen.findByText("Seed 1001")).toBeInTheDocument();
    expect(screen.getByText("Seed 1002")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /off-peak/i }));
    expect(onSelect).toHaveBeenCalledWith("sapon-offpeak");
  });
});
