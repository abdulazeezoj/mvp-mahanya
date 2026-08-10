"use client";

import { SirenIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ApproachDirection, TrafficState } from "@/lib/types";

const DIRECTION_LABELS: Record<ApproachDirection, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
};

export function ApproachStateGrid({
  trafficState,
}: {
  trafficState: TrafficState | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base font-semibold">
          Approach State
        </CardTitle>
        <CardDescription>
          Per-direction vehicle counts and queue lengths
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!trafficState ? (
          <p className="text-xs text-muted-foreground">
            No live state yet — select and run a scenario above.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(trafficState.approaches) as ApproachDirection[]).map(
              (direction) => {
                const approach = trafficState.approaches[direction];
                return (
                  <div
                    key={direction}
                    className="flex flex-col gap-1.5 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium">
                        {DIRECTION_LABELS[direction]}
                      </span>
                      {approach.hasEmergencyVehicle && (
                        <Badge variant="destructive">
                          <SirenIcon />
                          EV
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold tabular-nums">
                        {approach.vehicleCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        vehicles
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Queue: {approach.queueLength} · Waiting:{" "}
                      {approach.waitingTimeSec.toFixed(0)}s
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
