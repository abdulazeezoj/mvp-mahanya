import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePolling } from "./use-polling";

describe("usePolling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches immediately on mount", async () => {
    const fetcher = vi.fn().mockResolvedValue("first");
    const { result } = renderHook(() => usePolling(fetcher, 5000, []));

    await waitFor(() => expect(result.current.data).toBe("first"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches on the given interval", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue("tick");
    renderHook(() => usePolling(fetcher, 1000, []));

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("surfaces fetch errors without throwing", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePolling(fetcher, 5000, []));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("boom");
  });

  it("refresh() triggers an immediate re-fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue("value");
    const { result } = renderHook(() => usePolling(fetcher, 60_000, []));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    result.current.refresh();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
