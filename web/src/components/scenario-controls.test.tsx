import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScenarioControls } from "@/components/scenario-controls";
import { api } from "@/lib/api-client";
import { makeScenario } from "@/lib/test-fixtures";

vi.mock("@/lib/api-client", () => ({
  api: {
    runScenario: vi.fn(),
    pauseScenario: vi.fn(),
    stepScenario: vi.fn(),
    resetScenario: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("ScenarioControls", () => {
  it("disables all buttons when no scenario is selected", () => {
    render(<ScenarioControls scenarioId={null} />);
    for (const name of ["Run", "Pause", "Step", "Reset"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("enables buttons and calls the run endpoint when clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(api.runScenario).mockResolvedValue(
      makeScenario({ status: "running" }),
    );
    const onChanged = vi.fn();

    render(<ScenarioControls scenarioId="sapon-peak" onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(api.runScenario).toHaveBeenCalledWith("sapon-peak");
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("shows a toast and does not call onChanged when the API call fails", async () => {
    const { toast } = await import("sonner");
    const user = userEvent.setup();
    vi.mocked(api.pauseScenario).mockRejectedValue(new Error("network down"));
    const onChanged = vi.fn();

    render(<ScenarioControls scenarioId="sapon-peak" onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });
});
