"use client";

import Link from "next/link";
import { DecisionLogTable } from "@/components/decision-log-table";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api-client";
import { useSelectedScenario } from "@/lib/scenario-context";

const POLL_INTERVAL_MS = 2000;

export default function DecisionsPage() {
  const { selectedId } = useSelectedScenario();
  const { data: decisions } = usePolling(
    () =>
      selectedId ? api.getDecisionLog(selectedId, 200) : Promise.resolve([]),
    POLL_INTERVAL_MS,
    [selectedId],
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Decision Log"
        description={
          selectedId
            ? `Every scheduler decision that accepted, held, or overrode the model's recommendation. Scenario: ${selectedId}.`
            : "Every scheduler decision that accepted, held, or overrode the model's recommendation."
        }
      />
      {!selectedId ? (
        <Alert>
          <AlertTitle>No scenario selected</AlertTitle>
          <AlertDescription>
            Choose and run a scenario from the{" "}
            <Link href="/" className="underline">
              Live State
            </Link>{" "}
            page to see its decision log here.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <DecisionLogTable decisions={decisions ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
