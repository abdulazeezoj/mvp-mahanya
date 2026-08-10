"use client";

import {
  ArrowClockwiseIcon,
  PlayIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { EvaluationComparisonChart } from "@/components/evaluation-comparison-chart";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

/**
 * Direction each metric needs to move in for the intelligent controller to
 * be "better" than the fixed-time baseline. Per PRODUCT_SPEC.md's evaluation
 * section (functional requirement 6): waiting time, queue length, and
 * priority response time all shrink when control is better; throughput is
 * the exception — more vehicles cleared per hour is the improvement.
 */
const METRICS: {
  key: keyof EvaluationMetrics;
  label: string;
  unit: string;
  direction: "lower" | "higher";
  betterLabel: string;
  worseLabel: string;
}[] = [
  {
    key: "avgWaitingTimeSec",
    label: "Avg. Waiting Time",
    unit: "s",
    direction: "lower",
    betterLabel: "faster",
    worseLabel: "slower",
  },
  {
    key: "avgQueueLength",
    label: "Avg. Queue Length",
    unit: "veh",
    direction: "lower",
    betterLabel: "shorter queues",
    worseLabel: "longer queues",
  },
  {
    key: "throughputVehPerHour",
    label: "Throughput",
    unit: "veh/h",
    direction: "higher",
    betterLabel: "higher throughput",
    worseLabel: "lower throughput",
  },
  {
    key: "priorityResponseTimeSec",
    label: "Priority Response Time",
    unit: "s",
    direction: "lower",
    betterLabel: "faster response",
    worseLabel: "slower response",
  },
];

/**
 * Percentage change from the fixed-time baseline to the intelligent
 * controller, direction-adjusted so a positive result always means "the
 * intelligent controller is better on this metric". Returns null when
 * either value is missing or the baseline is zero (no meaningful ratio).
 */
function computeImprovement(
  intelligentValue: number | undefined,
  fixedTimeValue: number | undefined,
  direction: "lower" | "higher",
): { pct: number; better: boolean } | null {
  if (
    intelligentValue === undefined ||
    fixedTimeValue === undefined ||
    fixedTimeValue === 0
  ) {
    return null;
  }
  const signedDelta =
    direction === "lower"
      ? fixedTimeValue - intelligentValue
      : intelligentValue - fixedTimeValue;
  const pct = (signedDelta / Math.abs(fixedTimeValue)) * 100;
  return { pct: Math.abs(pct), better: pct > 0 };
}

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

  const intelligent = metrics?.find((m) => m.controller === "intelligent");
  const fixedTime = metrics?.find((m) => m.controller === "fixed-time");

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Evaluation"
        description="Compare the intelligent controller against the fixed-time baseline."
      />
      {!selectedId ? (
        <Alert>
          <AlertTitle>No scenario selected</AlertTitle>
          <AlertDescription>
            Choose a scenario from the{" "}
            <Link href="/" className="underline">
              Live State
            </Link>{" "}
            page, then run an evaluation here.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="font-heading text-base font-semibold">
                  Evaluate {selectedId}
                </CardTitle>
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
                {METRICS.map(
                  ({
                    key,
                    label,
                    unit,
                    direction,
                    betterLabel,
                    worseLabel,
                  }) => {
                    const intelligentValue = intelligent?.[key] as
                      | number
                      | undefined;
                    const fixedTimeValue = fixedTime?.[key] as
                      | number
                      | undefined;
                    const improvement = computeImprovement(
                      intelligentValue,
                      fixedTimeValue,
                      direction,
                    );
                    return (
                      <Card key={key} size="sm">
                        <CardHeader>
                          <CardDescription>{label}</CardDescription>
                          <CardTitle className="text-xl font-semibold tabular-nums">
                            {intelligentValue?.toFixed(1) ?? "—"} {unit}
                          </CardTitle>
                          {improvement && (
                            <Badge
                              variant={
                                improvement.better ? "default" : "secondary"
                              }
                              className="w-fit"
                            >
                              {improvement.better ? (
                                <TrendUpIcon />
                              ) : (
                                <TrendDownIcon />
                              )}
                              {improvement.pct.toFixed(0)}%{" "}
                              {improvement.better ? betterLabel : worseLabel}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Fixed-time baseline:{" "}
                            {fixedTimeValue?.toFixed(1) ?? "—"} {unit}
                          </span>
                        </CardHeader>
                      </Card>
                    );
                  },
                )}
              </div>
              <EvaluationComparisonChart
                intelligent={intelligent}
                fixedTime={fixedTime}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
