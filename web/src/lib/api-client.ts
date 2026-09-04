import type {
  EvaluationMetrics,
  NetworkGeometry,
  Scenario,
  SchedulerDecision,
  TrafficState,
} from "@/lib/types";

/**
 * The internal FastAPI relay's base URL. The dashboard is a static SPA
 * export (see ARCHITECTURE.md#internal-api-and-dashboard) that never talks
 * to SUMO/TraCI/PyTorch directly; every simulation fact comes from this
 * boundary. Override at build time with NEXT_PUBLIC_API_BASE_URL.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    statusText: string,
  ) {
    super(`API request to ${path} failed: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new ApiError(path, response.status, response.statusText);
  }
  return (await response.json()) as T;
}

export const api = {
  listScenarios: () => apiFetch<Scenario[]>("/api/scenarios"),
  getScenario: (scenarioId: string) =>
    apiFetch<Scenario>(`/api/scenarios/${encodeURIComponent(scenarioId)}`),
  getNetworkGeometry: (scenarioId: string) =>
    apiFetch<NetworkGeometry>(
      `/api/scenarios/${encodeURIComponent(scenarioId)}/network`,
    ),

  runScenario: (scenarioId: string) =>
    apiFetch<Scenario>(`/api/controls/${encodeURIComponent(scenarioId)}/run`, {
      method: "POST",
    }),
  pauseScenario: (scenarioId: string) =>
    apiFetch<Scenario>(
      `/api/controls/${encodeURIComponent(scenarioId)}/pause`,
      {
        method: "POST",
      },
    ),
  stepScenario: (scenarioId: string) =>
    apiFetch<Scenario>(`/api/controls/${encodeURIComponent(scenarioId)}/step`, {
      method: "POST",
    }),
  resetScenario: (scenarioId: string) =>
    apiFetch<Scenario>(
      `/api/controls/${encodeURIComponent(scenarioId)}/reset`,
      {
        method: "POST",
      },
    ),

  getState: (scenarioId: string) =>
    apiFetch<TrafficState | null>(
      `/api/snapshots/${encodeURIComponent(scenarioId)}/state`,
    ),
  getDecision: (scenarioId: string) =>
    apiFetch<SchedulerDecision | null>(
      `/api/snapshots/${encodeURIComponent(scenarioId)}/decision`,
    ),
  getDecisionLog: (scenarioId: string, limit = 100) =>
    apiFetch<SchedulerDecision[]>(
      `/api/snapshots/${encodeURIComponent(scenarioId)}/decisions?limit=${limit}`,
    ),
  getEvaluation: (scenarioId: string) =>
    apiFetch<EvaluationMetrics[]>(
      `/api/snapshots/${encodeURIComponent(scenarioId)}/evaluation`,
    ),
};

/** ws(s)://…/api/streams/{scenarioId}: the live per-tick relay. */
export function getStreamUrl(scenarioId: string): string {
  const wsBase = API_BASE_URL.replace(/^http/, "ws");
  return `${wsBase}/api/streams/${encodeURIComponent(scenarioId)}`;
}
