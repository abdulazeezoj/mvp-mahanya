import type {
  ApproachState,
  NetworkGeometry,
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
    vehicles: [],
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
    name: "Sapon Under-bridge: Peak Hour",
    status: "idle",
    seed: 1001,
    ...overrides,
  };
}

export function makeNetworkGeometry(
  overrides: Partial<NetworkGeometry> = {},
): NetworkGeometry {
  return {
    bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
    lanes: [
      {
        id: "north_in_0",
        edgeId: "north_in",
        direction: "north",
        kind: "in",
        shape: [
          [148.4, 300],
          [148.4, 157.2],
        ],
      },
      {
        id: "north_out_0",
        edgeId: "north_out",
        direction: "north",
        kind: "out",
        shape: [
          [151.6, 157.2],
          [151.6, 300],
        ],
      },
      {
        id: "south_in_0",
        edgeId: "south_in",
        direction: "south",
        kind: "in",
        shape: [
          [151.6, 0],
          [151.6, 142.8],
        ],
      },
      {
        id: "south_out_0",
        edgeId: "south_out",
        direction: "south",
        kind: "out",
        shape: [
          [148.4, 142.8],
          [148.4, 0],
        ],
      },
      {
        id: "east_in_0",
        edgeId: "east_in",
        direction: "east",
        kind: "in",
        shape: [
          [300, 151.6],
          [157.2, 151.6],
        ],
      },
      {
        id: "east_out_0",
        edgeId: "east_out",
        direction: "east",
        kind: "out",
        shape: [
          [157.2, 148.4],
          [300, 148.4],
        ],
      },
      {
        id: "west_in_0",
        edgeId: "west_in",
        direction: "west",
        kind: "in",
        shape: [
          [0, 148.4],
          [142.8, 148.4],
        ],
      },
      {
        id: "west_out_0",
        edgeId: "west_out",
        direction: "west",
        kind: "out",
        shape: [
          [142.8, 151.6],
          [0, 151.6],
        ],
      },
    ],
    ...overrides,
  };
}
