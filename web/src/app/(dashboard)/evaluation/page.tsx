"use client";

import { ArrowClockwiseIcon, PlayIcon } from "@phosphor-icons/react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { EvaluationComparisonChart } from "@/components/evaluation-comparison-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useSelectedScenario } from "@/lib/scenario-context";
import type { EvaluationMetrics } from "@/lib/types";

const METRICS: {
  key: keyof EvaluationMetrics;
  label: string;
  unit: string;
}[] = [
  { key: "avgWaitingTimeSec", label: "Avg. Waiting Time", unit: "s" },
  { key: "avgQueueLength", label: "Avg. Queue Length", unit: "veh" },
  { key: "throughputVehPerHour", label: "Throughput", unit: "veh/h" },
  {
    key: "priorityResponseTimeSec",
    label: "Priority Response Time",
    unit: "s",
  },
];

export default function EvaluationPage() {
  const { selectedId } = useSelectedScenario();
  const [metrics, setMetrics] = React.useState<EvaluationMetrics[] | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);

  const runEvaluation = React.useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const result = await api.getEvaluation(selectedId);
      setMetrics(result);
    } catch (error) {
      toast.error("Evaluation failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  if (!selectedId) {
    return (
      <Alert>
        <AlertTitle>No scenario selected</AlertTitle>
        <AlertDescription>
          Choose a scenario from the{" "}
          <Link href="/scenarios" className="underline">
            Scenarios
          </Link>{" "}
          page, then run an evaluation here.
        </AlertDescription>
      </Alert>
    );
  }

  const intelligent = metrics?.find((m) => m.controller === "intelligent");
  const fixedTime = metrics?.find((m) => m.controller === "fixed-time");

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Evaluate {selectedId}</CardTitle>
            <CardDescription>
              Runs the intelligent controller and the fixed-time baseline on
              identical conditions, head to head. Takes a few seconds.
            </CardDescription>
          </div>
          <Button onClick={runEvaluation} disabled={loading}>
            {loading ? (
              <ArrowClockwiseIcon className="animate-spin" />
            ) : (
              <PlayIcon />
            )}
            {loading ? "Running…" : "Run evaluation"}
          </Button>
        </CardHeader>
      </Card>

      {metrics && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map(({ key, label, unit }) => {
              const intelligentValue = intelligent?.[key] as number | undefined;
              const fixedTimeValue = fixedTime?.[key] as number | undefined;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {intelligentValue?.toFixed(1) ?? "—"} {unit}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Fixed-time baseline: {fixedTimeValue?.toFixed(1) ?? "—"}{" "}
                      {unit}
                    </span>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
          <EvaluationComparisonChart
            intelligent={intelligent}
            fixedTime={fixedTime}
          />
        </>
      )}
    </div>
  );
}
