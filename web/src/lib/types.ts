export type ApproachDirection = "north" | "south" | "east" | "west";

export type TrafficDirection<T> = Record<ApproachDirection, T>;

export interface ApproachState {
  vehicleCount: number;
  queueLength: number;
  hasEmergencyVehicle: boolean;
}

export interface TrafficState {
  scenarioId: string;
  tick: number;
  timestamp: string;
  approaches: TrafficDirection<ApproachState>;
  activePhase: string;
}

export interface PhaseRecommendation {
  recommendedPhase: string;
  confidence: number;
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
  recommendation: PhaseRecommendation;
  appliedPhase: string;
  reasonCode: SchedulerReasonCode;
  reasonDetail?: string;
}

export interface EvaluationMetrics {
  controller: "intelligent" | "fixed-time";
  scenarioId: string;
  avgWaitingTimeSec: number;
  avgQueueLength: number;
  throughputVehPerHour: number;
  priorityResponseTimeSec: number;
}

export interface Scenario {
  id: string;
  name: string;
  status: "idle" | "running" | "paused" | "completed";
  seed: number;
}
