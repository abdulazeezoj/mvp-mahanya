"use client";

import {
  CarIcon,
  GaugeIcon,
  ListChecksIcon,
  SirenIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SchedulerDecision, TrafficState } from "@/lib/types";

const REASON_LABELS: Record<string, string> = {
  model_accepted: "Model accepted",
  min_green_hold: "Min green hold",
  max_green_force: "Max green force",
  anti_starvation_force: "Anti-starvation",
  emergency_preempt: "Emergency pre-empt",
};

export function JunctionSummaryCards({
  trafficState,
  decision,
}: {
  trafficState: TrafficState | null;
  decision: SchedulerDecision | null;
}) {
  const approaches = trafficState ? Object.values(trafficState.approaches) : [];
  const totalQueued = approaches.reduce(
    (sum, approach) => sum + approach.queueLength,
    0,
  );
  const emergencyPresent = approaches.some(
    (approach) => approach.hasEmergencyVehicle,
  );

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader>
          <CardDescription>Total Queued</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums">
            {trafficState ? totalQueued : "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <CarIcon />
              vehicles
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          {trafficState
            ? `Across all approaches, tick ${trafficState.tick}`
            : "No live state yet"}
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Active Phase</CardDescription>
          <CardTitle className="text-xl font-semibold">
            {trafficState?.activePhase ?? "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <GaugeIcon />
              live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          {trafficState ? `Scenario ${trafficState.scenarioId}` : "Not running"}
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Emergency Presence</CardDescription>
          <CardTitle className="text-xl font-semibold">
            {emergencyPresent ? "Detected" : "None"}
          </CardTitle>
          <CardAction>
            <Badge variant={emergencyPresent ? "destructive" : "outline"}>
              <SirenIcon />
              {emergencyPresent ? "active" : "clear"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          Pre-emption overrides normal control when detected
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Last Reason Code</CardDescription>
          <CardTitle className="text-xl font-semibold">
            {decision ? REASON_LABELS[decision.reasonCode] : "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ListChecksIcon />
              scheduler
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          {decision?.reasonDetail ?? "No override detail"}
        </CardFooter>
      </Card>
    </div>
  );
}
