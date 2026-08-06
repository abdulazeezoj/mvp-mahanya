"use client";

import Link from "next/link";
import { DecisionLogTable } from "@/components/decision-log-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  if (!selectedId) {
    return (
      <Alert>
        <AlertTitle>No scenario selected</AlertTitle>
        <AlertDescription>
          Choose and run a scenario from the{" "}
          <Link href="/scenarios" className="underline">
            Scenarios
          </Link>{" "}
          page to see its decision log here.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision Log</CardTitle>
        <CardDescription>
          Every scheduler decision that accepted, held, or overrode the model's
          recommendation, with its reason code. Scenario: {selectedId}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DecisionLogTable decisions={decisions ?? []} />
      </CardContent>
    </Card>
  );
}
