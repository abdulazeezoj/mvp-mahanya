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
  trafficState: TrafficState;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approach State</CardTitle>
        <CardDescription>
          Per-direction vehicle counts and queue lengths
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(trafficState.approaches) as ApproachDirection[]).map(
            (direction) => {
              const approach = trafficState.approaches[direction];
              return (
                <div
                  key={direction}
                  className="flex flex-col gap-2 rounded-lg border border-border p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
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
                    <span className="text-2xl font-semibold tabular-nums">
                      {approach.vehicleCount}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      vehicles
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Queue: {approach.queueLength}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </CardContent>
    </Card>
  );
}
