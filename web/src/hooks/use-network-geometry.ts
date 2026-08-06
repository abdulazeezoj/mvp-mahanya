"use client";

import * as React from "react";
import { api } from "@/lib/api-client";
import type { NetworkGeometry } from "@/lib/types";

/**
 * The road layout never changes for a scenario's lifetime, so this fetches
 * once per scenario id and caches the result across remounts/switches —
 * no polling needed, unlike the per-tick traffic state.
 */
export function useNetworkGeometry(
  scenarioId: string | null,
): NetworkGeometry | null {
  const cacheRef = React.useRef(new Map<string, NetworkGeometry>());
  const [geometry, setGeometry] = React.useState<NetworkGeometry | null>(
    scenarioId ? (cacheRef.current.get(scenarioId) ?? null) : null,
  );

  React.useEffect(() => {
    if (!scenarioId) {
      setGeometry(null);
      return;
    }
    const cached = cacheRef.current.get(scenarioId);
    if (cached) {
      setGeometry(cached);
      return;
    }
    let cancelled = false;
    api
      .getNetworkGeometry(scenarioId)
      .then((result) => {
        if (cancelled) return;
        cacheRef.current.set(scenarioId, result);
        setGeometry(result);
      })
      .catch(() => {
        if (!cancelled) setGeometry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  return geometry;
}
