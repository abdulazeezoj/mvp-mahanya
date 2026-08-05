import type {
  EvaluationMetrics,
  Scenario,
  SchedulerDecision,
  TrafficState,
} from "@/lib/types";

export const mockTrafficState: TrafficState = {
  scenarioId: "sapon-peak-01",
  tick: 482,
  timestamp: "2026-08-04T20:41:12Z",
  activePhase: "NS_GREEN",
  approaches: {
    north: { vehicleCount: 18, queueLength: 9, hasEmergencyVehicle: false },
    south: { vehicleCount: 22, queueLength: 14, hasEmergencyVehicle: false },
    east: { vehicleCount: 7, queueLength: 3, hasEmergencyVehicle: true },
    west: { vehicleCount: 11, queueLength: 5, hasEmergencyVehicle: false },
  },
};

export const mockLatestDecision: SchedulerDecision = {
  tick: 482,
  timestamp: "2026-08-04T20:41:12Z",
  recommendation: { recommendedPhase: "NS_GREEN", confidence: 0.87 },
  appliedPhase: "EW_GREEN",
  reasonCode: "emergency_preempt",
  reasonDetail: "Emergency vehicle detected on East approach",
};

export const mockDecisionLog: SchedulerDecision[] = [
  {
    tick: 482,
    timestamp: "2026-08-04T20:41:12Z",
    recommendation: { recommendedPhase: "NS_GREEN", confidence: 0.87 },
    appliedPhase: "EW_GREEN",
    reasonCode: "emergency_preempt",
    reasonDetail: "Emergency vehicle detected on East approach",
  },
  {
    tick: 478,
    timestamp: "2026-08-04T20:40:52Z",
    recommendation: { recommendedPhase: "NS_GREEN", confidence: 0.81 },
    appliedPhase: "NS_GREEN",
    reasonCode: "model_accepted",
  },
  {
    tick: 465,
    timestamp: "2026-08-04T20:39:40Z",
    recommendation: { recommendedPhase: "EW_GREEN", confidence: 0.62 },
    appliedPhase: "NS_GREEN",
    reasonCode: "min_green_hold",
    reasonDetail: "NS_GREEN has 6s remaining before minimum green elapses",
  },
  {
    tick: 441,
    timestamp: "2026-08-04T20:37:56Z",
    recommendation: { recommendedPhase: "NS_GREEN", confidence: 0.74 },
    appliedPhase: "NS_GREEN",
    reasonCode: "max_green_force",
    reasonDetail: "EW_GREEN reached maximum green duration",
  },
  {
    tick: 402,
    timestamp: "2026-08-04T20:34:58Z",
    recommendation: { recommendedPhase: "NS_GREEN", confidence: 0.58 },
    appliedPhase: "WEST_GREEN",
    reasonCode: "anti_starvation_force",
    reasonDetail: "West approach exceeded max wait threshold (120s)",
  },
  {
    tick: 388,
    timestamp: "2026-08-04T20:33:44Z",
    recommendation: { recommendedPhase: "EW_GREEN", confidence: 0.91 },
    appliedPhase: "EW_GREEN",
    reasonCode: "model_accepted",
  },
  {
    tick: 355,
    timestamp: "2026-08-04T20:30:59Z",
    recommendation: { recommendedPhase: "NS_GREEN", confidence: 0.69 },
    appliedPhase: "NS_GREEN",
    reasonCode: "model_accepted",
  },
];

export const mockEvaluationMetrics: EvaluationMetrics[] = [
  {
    controller: "intelligent",
    scenarioId: "sapon-peak-01",
    avgWaitingTimeSec: 38.4,
    avgQueueLength: 6.2,
    throughputVehPerHour: 1420,
    priorityResponseTimeSec: 9.1,
  },
  {
    controller: "fixed-time",
    scenarioId: "sapon-peak-01",
    avgWaitingTimeSec: 61.7,
    avgQueueLength: 10.8,
    throughputVehPerHour: 1180,
    priorityResponseTimeSec: 24.6,
  },
  {
    controller: "intelligent",
    scenarioId: "sapon-offpeak-01",
    avgWaitingTimeSec: 19.2,
    avgQueueLength: 2.7,
    throughputVehPerHour: 980,
    priorityResponseTimeSec: 7.4,
  },
  {
    controller: "fixed-time",
    scenarioId: "sapon-offpeak-01",
    avgWaitingTimeSec: 27.5,
    avgQueueLength: 4.1,
    throughputVehPerHour: 910,
    priorityResponseTimeSec: 21.9,
  },
];

export const mockEvaluationTrend: {
  tick: number;
  intelligentWaitingTimeSec: number;
  fixedTimeWaitingTimeSec: number;
}[] = [
  { tick: 0, intelligentWaitingTimeSec: 22, fixedTimeWaitingTimeSec: 30 },
  { tick: 60, intelligentWaitingTimeSec: 26, fixedTimeWaitingTimeSec: 38 },
  { tick: 120, intelligentWaitingTimeSec: 31, fixedTimeWaitingTimeSec: 47 },
  { tick: 180, intelligentWaitingTimeSec: 35, fixedTimeWaitingTimeSec: 55 },
  { tick: 240, intelligentWaitingTimeSec: 40, fixedTimeWaitingTimeSec: 63 },
  { tick: 300, intelligentWaitingTimeSec: 38, fixedTimeWaitingTimeSec: 61 },
  { tick: 360, intelligentWaitingTimeSec: 36, fixedTimeWaitingTimeSec: 58 },
  { tick: 420, intelligentWaitingTimeSec: 39, fixedTimeWaitingTimeSec: 64 },
  { tick: 480, intelligentWaitingTimeSec: 38, fixedTimeWaitingTimeSec: 62 },
];

export const mockScenarios: Scenario[] = [
  {
    id: "sapon-peak-01",
    name: "Sapon — Peak Hour",
    status: "running",
    seed: 1001,
  },
  {
    id: "sapon-offpeak-01",
    name: "Sapon — Off-Peak",
    status: "idle",
    seed: 1002,
  },
  {
    id: "sapon-peak-02",
    name: "Sapon — Peak Hour (wet)",
    status: "completed",
    seed: 1003,
  },
  {
    id: "sapon-emergency-01",
    name: "Sapon — Emergency Drill",
    status: "idle",
    seed: 1004,
  },
];
