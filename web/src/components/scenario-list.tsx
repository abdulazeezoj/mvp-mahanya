"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Scenario } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<
  Scenario["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  idle: "outline",
  running: "default",
  paused: "secondary",
  completed: "secondary",
};

export function ScenarioList({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {scenarios.map((scenario) => (
        <button
          type="button"
          key={scenario.id}
          onClick={() => onSelect(scenario.id)}
          className="text-left"
        >
          <Card
            className={cn(
              "transition-colors hover:ring-2 hover:ring-ring/50",
              selectedId === scenario.id && "ring-2 ring-ring",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {scenario.name}
                <Badge variant={STATUS_VARIANT[scenario.status]}>
                  {scenario.status}
                </Badge>
              </CardTitle>
              <CardDescription>Seed {scenario.seed}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {scenario.id}
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
