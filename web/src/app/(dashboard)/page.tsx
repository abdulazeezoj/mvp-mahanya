"use client";

import { ApproachStateGrid } from "@/components/approach-state-grid";
import { DecisionComparisonCard } from "@/components/decision-comparison-card";
import { JunctionSimulationView } from "@/components/junction-simulation-view";
import { JunctionSummaryCards } from "@/components/junction-summary-cards";
import { PageHeader } from "@/components/page-header";
import { ScenarioControls } from "@/components/scenario-controls";
import { ScenarioPicker } from "@/components/scenario-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useNetworkGeometry } from "@/hooks/use-network-geometry";
import { usePolling } from "@/hooks/use-polling";
import { useScenarioStream } from "@/hooks/use-scenario-stream";
import { api } from "@/lib/api-client";
import { useSelectedScenario } from "@/lib/scenario-context";

const POLL_INTERVAL_MS = 2000;

export default function LiveStatePage() {
  const { selectedId, setSelectedId } = useSelectedScenario();
  const { state, decision, connected } = useScenarioStream(selectedId);
  const geometry = useNetworkGeometry(selectedId);
  const { data: scenarios, refresh } = usePolling(
    () => api.listScenarios(),
    POLL_INTERVAL_MS,
    [],
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Live State"
        description="Select a scenario, run it, and watch signal phase, queues, and vehicle positions at the Sapon Under-bridge Junction in real time."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <ScenarioPicker
          scenarios={scenarios ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <Separator orientation="vertical" className="h-6" />
        <ScenarioControls scenarioId={selectedId} onChanged={refresh} />
      </div>

      {selectedId && !connected && (
        <Alert>
          <AlertTitle>Connecting to {selectedId}…</AlertTitle>
          <AlertDescription>
            Waiting for the live stream from the internal relay.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0">
          {selectedId ? (
            <JunctionSimulationView geometry={geometry} trafficState={state} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base font-semibold">
                  Live Junction
                </CardTitle>
                <CardDescription>
                  The Sapon Under-bridge Junction, rendered from live SUMO
                  vehicle positions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex aspect-square w-full max-w-3xl items-center justify-center rounded-lg border border-dashed border-border">
                  <p className="px-6 text-center text-xs text-muted-foreground">
                    Select a scenario above to view the live junction.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <JunctionSummaryCards trafficState={state} decision={decision} />
          <DecisionComparisonCard decision={decision} />
          <ApproachStateGrid trafficState={state} />
        </div>
      </div>
    </div>
  );
}
