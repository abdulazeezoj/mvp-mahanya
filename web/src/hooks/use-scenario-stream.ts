"use client";

import * as React from "react";

import { getStreamUrl } from "@/lib/api-client";
import type {
  DecisionLogRecord,
  SchedulerDecision,
  TrafficState,
} from "@/lib/types";

interface ScenarioStreamState {
  state: TrafficState | null;
  decision: SchedulerDecision | null;
  connected: boolean;
}

const RECONNECT_DELAY_MS = 2000;

/** Subscribes to /api/streams/{scenarioId}, reconnecting on drop. */
export function useScenarioStream(
  scenarioId: string | null,
): ScenarioStreamState {
  const [state, setState] = React.useState<TrafficState | null>(null);
  const [decision, setDecision] = React.useState<SchedulerDecision | null>(
    null,
  );
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    setState(null);
    setDecision(null);
    setConnected(false);

    if (!scenarioId) {
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      socket = new WebSocket(getStreamUrl(scenarioId));

      socket.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const record = JSON.parse(event.data) as DecisionLogRecord;
          setState(record.state);
          setDecision(record.decision);
        } catch {
          // Ignore malformed frames rather than tearing down the stream.
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [scenarioId]);

  return { state, decision, connected };
}
