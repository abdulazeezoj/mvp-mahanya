"use client";

import {
  ArrowClockwiseIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ScenarioControls({
  scenarioId,
}: {
  scenarioId: string | null;
}) {
  // TODO: wire to POST /api/controls once the FastAPI relay exposes it.
  const disabled = !scenarioId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Controls</CardTitle>
        <CardDescription>
          {scenarioId
            ? `Selected scenario: ${scenarioId}`
            : "Select a scenario to enable controls"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" size="icon" disabled={disabled}>
          <PlayIcon />
          <span className="sr-only">Run</span>
        </Button>
        <Button variant="outline" size="icon" disabled={disabled}>
          <PauseIcon />
          <span className="sr-only">Pause</span>
        </Button>
        <Button variant="outline" size="icon" disabled={disabled}>
          <SkipForwardIcon />
          <span className="sr-only">Step</span>
        </Button>
        <Button variant="outline" size="icon" disabled={disabled}>
          <ArrowClockwiseIcon />
          <span className="sr-only">Reset</span>
        </Button>
      </CardContent>
    </Card>
  );
}
