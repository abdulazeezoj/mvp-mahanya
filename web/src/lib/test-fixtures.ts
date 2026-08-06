import type {
  ApproachState,
  Scenario,
  SchedulerDecision,
  TrafficState,
} from "@/lib/types";

export function makeApproach(
  overrides: Partial<ApproachState> = {},
): ApproachState {
  return {
    vehicleCount: 0,
    queueLength: 0,
    waitingTimeSec: 0,
    hasEmergencyVehicle: false,
    ...overrides,
  };
}

export function makeTrafficState(
  overrides: Partial<TrafficState> = {},
): TrafficState {
  return {
    scenarioId: "sapon-peak",
    tick: 1,
    timestamp: "2026-03-03T07:30:00Z",
    activePhase: "NORTH_GREEN",
    elapsedPhaseTimeSec: 2,
    approaches: {
      north: makeApproach(),
      south: makeApproach(),
      east: makeApproach(),
      west: makeApproach(),
    },
    ...overrides,
  };
}

export function makeDecision(
  overrides: Partial<SchedulerDecision> = {},
): SchedulerDecision {
  return {
    tick: 1,
    timestamp: "2026-03-03T07:30:00Z",
    recommendation: {
      recommendedPhase: "NORTH_GREEN",
      confidence: 0.9,
    },
    appliedPhase: "NORTH_GREEN",
    reasonCode: "model_accepted",
    ...overrides,
  };
}

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "sapon-peak",
    name: "Sapon Under-bridge — Peak Hour",
    status: "idle",
    seed: 1001,
    ...overrides,
  };
}
