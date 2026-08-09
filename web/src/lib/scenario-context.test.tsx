import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScenarioProvider, useSelectedScenario } from "./scenario-context";

describe("useSelectedScenario", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts null and hydrates from localStorage after mount", async () => {
    window.localStorage.setItem("mahanya:selectedScenarioId", "sapon-peak");
    const { result } = renderHook(() => useSelectedScenario(), {
      wrapper: ScenarioProvider,
    });
    // useEffect runs synchronously-ish under React Testing Library's act.
    expect(result.current.selectedId).toBe("sapon-peak");
  });

  it("persists selection changes to localStorage", () => {
    const { result } = renderHook(() => useSelectedScenario(), {
      wrapper: ScenarioProvider,
    });
    act(() => {
      result.current.setSelectedId("sapon-offpeak");
    });
    expect(result.current.selectedId).toBe("sapon-offpeak");
    expect(window.localStorage.getItem("mahanya:selectedScenarioId")).toBe(
      "sapon-offpeak",
    );
  });

  it("clears localStorage when set to null", () => {
    const { result } = renderHook(() => useSelectedScenario(), {
      wrapper: ScenarioProvider,
    });
    act(() => {
      result.current.setSelectedId("sapon-peak");
    });
    act(() => {
      result.current.setSelectedId(null);
    });
    expect(result.current.selectedId).toBeNull();
    expect(
      window.localStorage.getItem("mahanya:selectedScenarioId"),
    ).toBeNull();
  });

  it("throws when used outside a ScenarioProvider", () => {
    expect(() => renderHook(() => useSelectedScenario())).toThrow(
      /must be used within a ScenarioProvider/,
    );
  });
});
