import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, getStreamUrl } from "./api-client";

function mockFetchOnce(
  body: unknown,
  init?: { ok?: boolean; status?: number },
) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: () => Promise.resolve(body),
    }),
  );
}

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listScenarios GETs /api/scenarios and returns the parsed body", async () => {
    mockFetchOnce([
      { id: "sapon-peak", name: "Peak", status: "idle", seed: 1 },
    ]);
    const result = await api.listScenarios();
    expect(result).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/scenarios"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("runScenario POSTs to /api/controls/{id}/run", async () => {
    mockFetchOnce({
      id: "sapon-peak",
      name: "Peak",
      status: "running",
      seed: 1,
    });
    await api.runScenario("sapon-peak");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/controls/sapon-peak/run"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("encodes scenario ids in the URL path", async () => {
    mockFetchOnce({ id: "a b", name: "x", status: "idle", seed: 1 });
    await api.getScenario("a b");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/scenarios/a%20b"),
      expect.anything(),
    );
  });

  it("throws ApiError with status details on a non-ok response", async () => {
    mockFetchOnce(null, { ok: false, status: 404 });
    await expect(api.getScenario("missing")).rejects.toThrow(ApiError);
  });
});

describe("getStreamUrl", () => {
  it("converts http(s) to ws(s) and appends the streams path", () => {
    // API_BASE_URL is resolved once at module load from
    // NEXT_PUBLIC_API_BASE_URL, defaulting to http://localhost:8000 when
    // unset (as in this test environment).
    expect(getStreamUrl("sapon-peak")).toBe(
      "ws://localhost:8000/api/streams/sapon-peak",
    );
  });
});
