"use client";

import { ApproachStateGrid } from "@/components/approach-state-grid";
import { DecisionComparisonCard } from "@/components/decision-comparison-card";
import { JunctionSimulationView } from "@/components/junction-simulation-view";
import { JunctionSummaryCards } from "@/components/junction-summary-cards";
import { PageHeader } from "@/components/page-header";
import { ScenarioControls } from "@/components/scenario-controls";
import { ScenarioList } from "@/components/scenario-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  const selected = scenarios?.find((s) => s.id === selectedId);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Live State"
        description="Select a scenario, run it, and watch signal phase, queues, and vehicle positions at the Sapon Under-bridge Junction in real time."
      />
      <ScenarioControls
        scenarioId={selectedId}
        status={selected?.status}
        onChanged={refresh}
      />
      <ScenarioList
        scenarios={scenarios ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selectedId && !connected && (
        <Alert>
          <AlertTitle>Connecting to {selectedId}…</AlertTitle>
          <AlertDescription>
            Waiting for the live stream from the internal relay.
          </AlertDescription>
        </Alert>
      )}
      {selectedId && (
        <JunctionSimulationView geometry={geometry} trafficState={state} />
      )}
      <JunctionSummaryCards trafficState={state} decision={decision} />
      <ApproachStateGrid trafficState={state} />
      <DecisionComparisonCard decision={decision} />
    </div>
  );
}
