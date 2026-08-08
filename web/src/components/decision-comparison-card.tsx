"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SchedulerDecision } from "@/lib/types";

const REASON_VARIANT: Record<
  SchedulerDecision["reasonCode"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  model_accepted: "outline",
  min_green_hold: "secondary",
  max_green_force: "secondary",
  anti_starvation_force: "default",
  emergency_preempt: "destructive",
};

export function DecisionComparisonCard({
  decision,
}: {
  decision: SchedulerDecision | null;
}) {
  const matched =
    decision?.recommendation != null &&
    decision.recommendation.recommendedPhase === decision.appliedPhase;

  if (!decision) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Model vs. Scheduler
          </CardTitle>
          <CardDescription>
            The model's recommendation is advisory only — the scheduler is the
            sole authority over what's applied.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          No decision recorded yet — run the scenario from the Scenarios page.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base font-semibold">
          Model vs. Scheduler
        </CardTitle>
        <CardDescription>
          The model's recommendation is advisory only — the scheduler is the
          sole authority over what's applied.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Model recommendation
            </span>
            <span className="text-base font-semibold">
              {decision.recommendation
                ? decision.recommendation.recommendedPhase
                : "bypassed (emergency pre-emption)"}
            </span>
            <span className="text-xs text-muted-foreground">
              {decision.recommendation
                ? `${Math.round(decision.recommendation.confidence * 100)}% confidence`
                : " "}
            </span>
          </div>
          <ArrowRightIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1 text-right">
            <span className="text-xs text-muted-foreground">
              Scheduler applied
            </span>
            <span className="text-base font-semibold">
              {decision.appliedPhase}
            </span>
            <span className="text-xs text-muted-foreground">
              {matched ? "matched recommendation" : "overridden"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={REASON_VARIANT[decision.reasonCode]}>
            {decision.reasonCode}
          </Badge>
          {decision.reasonDetail && (
            <span className="text-xs text-muted-foreground">
              {decision.reasonDetail}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
