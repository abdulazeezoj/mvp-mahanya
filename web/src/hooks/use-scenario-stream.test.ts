import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScenarioStream } from "./use-scenario-stream";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("useScenarioStream", () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.unstubAllGlobals();
  });

  it("does nothing when scenarioId is null", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const { result } = renderHook(() => useScenarioStream(null));
    expect(result.current).toEqual({
      state: null,
      decision: null,
      connected: false,
    });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("connects to the streams endpoint for the given scenario", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    renderHook(() => useScenarioStream("sapon-peak"));
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]?.url).toContain(
      "/api/streams/sapon-peak",
    );
  });

  it("updates state/decision from incoming DecisionLogRecord messages", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const { result } = renderHook(() => useScenarioStream("sapon-peak"));
    const socket = FakeWebSocket.instances[0];
    socket?.emitOpen();

    await waitFor(() => expect(result.current.connected).toBe(true));

    socket?.emitMessage({
      state: { scenarioId: "sapon-peak", tick: 1, activePhase: "NORTH_GREEN" },
      decision: {
        tick: 1,
        appliedPhase: "NORTH_GREEN",
        reasonCode: "model_accepted",
      },
    });

    await waitFor(() => expect(result.current.state?.tick).toBe(1));
    expect(result.current.decision?.reasonCode).toBe("model_accepted");
  });

  it("marks disconnected when the socket closes", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const { result } = renderHook(() => useScenarioStream("sapon-peak"));
    const socket = FakeWebSocket.instances[0];
    socket?.emitOpen();
    await waitFor(() => expect(result.current.connected).toBe(true));

    socket?.close();
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  it("tears down the socket and resets state when scenarioId changes", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const { rerender } = renderHook(({ id }) => useScenarioStream(id), {
      initialProps: { id: "sapon-peak" as string | null },
    });
    const first = FakeWebSocket.instances[0];

    rerender({ id: "sapon-offpeak" });

    expect(first?.closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
