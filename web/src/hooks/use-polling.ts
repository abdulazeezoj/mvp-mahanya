"use client";

import * as React from "react";

/**
 * Re-runs `fetcher` immediately and then every `intervalMs`, exposing the
 * latest resolved value. Used for snapshot-style /api/* reads that don't
 * warrant a WebSocket (scenario status, decision log).
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: React.DependencyList,
): { data: T | null; error: Error | null; refresh: () => void } {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = React.useCallback(() => {
    let cancelled = false;
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const cancel = run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancel();
      clearInterval(id);
    };
  }, [run, intervalMs, ...deps]);

  return { data, error, refresh: run };
}
