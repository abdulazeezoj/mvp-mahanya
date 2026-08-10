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
import { api } from "@/lib/api-client";

type Action = "run" | "pause" | "step" | "reset";

export function ScenarioControls({
  scenarioId,
  onChanged,
}: {
  scenarioId: string | null;
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
    <div className="flex items-center gap-1.5">
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
    </div>
  );
}
