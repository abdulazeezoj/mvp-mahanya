"use client";

import {
  ArrowClockwiseIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api-client";
import type { ScenarioStatus } from "@/lib/types";

type Action = "run" | "pause" | "step" | "reset";

export function ScenarioControls({
  scenarioId,
  status,
  onChanged,
}: {
  scenarioId: string | null;
  status?: ScenarioStatus;
  onChanged?: () => void;
}) {
  const [pending, setPending] = React.useState<Action | null>(null);
  const disabled = !scenarioId;

  const run = React.useCallback(
    async (action: Action, fn: (id: string) => Promise<unknown>) => {
      if (!scenarioId) return;
      setPending(action);
      try {
        await fn(scenarioId);
        onChanged?.();
      } catch (error) {
        toast.error(`Failed to ${action} scenario`, {
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setPending(null);
      }
    },
    [scenarioId, onChanged],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base font-semibold">
          Run Controls
        </CardTitle>
        <CardDescription>
          {scenarioId
            ? `Selected scenario: ${scenarioId}${status ? ` (${status})` : ""}`
            : "Select a scenario below to enable controls"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || pending !== null}
          onClick={() => run("run", api.runScenario)}
        >
          <PlayIcon />
          <span className="sr-only">Run</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || pending !== null}
          onClick={() => run("pause", api.pauseScenario)}
        >
          <PauseIcon />
          <span className="sr-only">Pause</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || pending !== null}
          onClick={() => run("step", api.stepScenario)}
        >
          <SkipForwardIcon />
          <span className="sr-only">Step</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || pending !== null}
          onClick={() => run("reset", api.resetScenario)}
        >
          <ArrowClockwiseIcon />
          <span className="sr-only">Reset</span>
        </Button>
      </CardContent>
    </Card>
  );
}
