export type ApproachDirection = "north" | "south" | "east" | "west";

export type TrafficDirection<T> = Record<ApproachDirection, T>;

/**
 * Single-ring, one-approach-at-a-time phase space: each direction's green
 * and yellow, plus one shared all-red clearance state. Must match
 * api/src/mahanya/schemas/traffic.py::Phase exactly.
 */
export type Phase =
  | "NORTH_GREEN"
  | "NORTH_YELLOW"
  | "SOUTH_GREEN"
  | "SOUTH_YELLOW"
  | "EAST_GREEN"
  | "EAST_YELLOW"
  | "WEST_GREEN"
  | "WEST_YELLOW"
  | "ALL_RED";

export const GREEN_PHASES: Phase[] = [
  "NORTH_GREEN",
  "SOUTH_GREEN",
  "EAST_GREEN",
  "WEST_GREEN",
];

export interface ApproachState {
  vehicleCount: number;
  queueLength: number;
  waitingTimeSec: number;
  hasEmergencyVehicle: boolean;
}

export interface TrafficState {
  scenarioId: string;
  tick: number;
  timestamp: string;
  approaches: TrafficDirection<ApproachState>;
  activePhase: Phase;
  elapsedPhaseTimeSec: number;
}

export interface PhaseRecommendation {
  recommendedPhase: Phase;
  confidence: number;
  phaseScores?: Partial<Record<Phase, number>>;
}

export type SchedulerReasonCode =
  | "model_accepted"
  | "min_green_hold"
  | "max_green_force"
  | "anti_starvation_force"
  | "emergency_preempt";

export interface SchedulerDecision {
  tick: number;
  timestamp: string;
  /** null only when the tick was an emergency pre-emption short-circuit,
   * or when the model wasn't consulted for some other reason. */
  recommendation: PhaseRecommendation | null;
  appliedPhase: Phase;
  reasonCode: SchedulerReasonCode;
  reasonDetail?: string | null;
}

export interface DecisionLogRecord {
  state: TrafficState;
  decision: SchedulerDecision;
}

export type ControllerKind = "intelligent" | "fixed-time";

export interface EvaluationMetrics {
  controller: ControllerKind;
  scenarioId: string;
  avgWaitingTimeSec: number;
  avgQueueLength: number;
  throughputVehPerHour: number;
  priorityResponseTimeSec: number;
}

export type ScenarioStatus = "idle" | "running" | "paused" | "completed";

export interface Scenario {
  id: string;
  name: string;
  status: ScenarioStatus;
  seed: number;
}
