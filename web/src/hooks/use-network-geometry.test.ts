import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";
import { makeNetworkGeometry } from "@/lib/test-fixtures";
import { useNetworkGeometry } from "./use-network-geometry";

vi.mock("@/lib/api-client", () => ({
  api: { getNetworkGeometry: vi.fn() },
}));

describe("useNetworkGeometry", () => {
  beforeEach(() => {
    vi.mocked(api.getNetworkGeometry).mockReset();
  });

  it("returns null when no scenario is selected", () => {
    const { result } = renderHook(() => useNetworkGeometry(null));
    expect(result.current).toBeNull();
  });

  it("fetches geometry for the selected scenario", async () => {
    const geometry = makeNetworkGeometry();
    vi.mocked(api.getNetworkGeometry).mockResolvedValue(geometry);

    const { result } = renderHook(() => useNetworkGeometry("sapon-peak"));

    await waitFor(() => expect(result.current).toEqual(geometry));
    expect(api.getNetworkGeometry).toHaveBeenCalledWith("sapon-peak");
  });

  it("caches geometry per scenario id instead of re-fetching", async () => {
    const geometry = makeNetworkGeometry();
    vi.mocked(api.getNetworkGeometry).mockResolvedValue(geometry);

    const { result, rerender } = renderHook(
      ({ scenarioId }: { scenarioId: string | null }) =>
        useNetworkGeometry(scenarioId),
      { initialProps: { scenarioId: "sapon-peak" as string | null } },
    );
    await waitFor(() => expect(result.current).toEqual(geometry));

    rerender({ scenarioId: null });
    expect(result.current).toBeNull();
    rerender({ scenarioId: "sapon-peak" });

    await waitFor(() => expect(result.current).toEqual(geometry));
    expect(api.getNetworkGeometry).toHaveBeenCalledTimes(1);
  });
});
