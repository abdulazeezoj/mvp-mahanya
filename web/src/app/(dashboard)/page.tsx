"use client";

import Link from "next/link";
import { ApproachStateGrid } from "@/components/approach-state-grid";
import { DecisionComparisonCard } from "@/components/decision-comparison-card";
import { JunctionSimulationView } from "@/components/junction-simulation-view";
import { JunctionSummaryCards } from "@/components/junction-summary-cards";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNetworkGeometry } from "@/hooks/use-network-geometry";
import { useScenarioStream } from "@/hooks/use-scenario-stream";
import { useSelectedScenario } from "@/lib/scenario-context";

export default function LiveStatePage() {
  const { selectedId } = useSelectedScenario();
  const { state, decision, connected } = useScenarioStream(selectedId);
  const geometry = useNetworkGeometry(selectedId);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Live State"
        description="Real-time signal phase, queues, and vehicle positions at the Sapon Under-bridge Junction."
      />
      {!selectedId ? (
        <Alert>
          <AlertTitle>No scenario selected</AlertTitle>
          <AlertDescription>
            Choose and run a scenario from the{" "}
            <Link href="/scenarios" className="underline">
              Scenarios
            </Link>{" "}
            page to see live junction state here.
          </AlertDescription>
        </Alert>
      ) : !connected ? (
        <Alert>
          <AlertTitle>Connecting to {selectedId}…</AlertTitle>
          <AlertDescription>
            Waiting for the live stream from the internal relay.
          </AlertDescription>
        </Alert>
      ) : null}
      {selectedId && (
        <JunctionSimulationView geometry={geometry} trafficState={state} />
      )}
      <JunctionSummaryCards trafficState={state} decision={decision} />
      <ApproachStateGrid trafficState={state} />
      <DecisionComparisonCard decision={decision} />
    </div>
  );
}
