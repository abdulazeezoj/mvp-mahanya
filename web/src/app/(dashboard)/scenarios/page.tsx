"use client";

import { PageHeader } from "@/components/page-header";
import { ScenarioControls } from "@/components/scenario-controls";
import { ScenarioList } from "@/components/scenario-list";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api-client";
import { useSelectedScenario } from "@/lib/scenario-context";

const POLL_INTERVAL_MS = 2000;

export default function ScenariosPage() {
  const { selectedId, setSelectedId } = useSelectedScenario();
  const { data: scenarios, refresh } = usePolling(
    () => api.listScenarios(),
    POLL_INTERVAL_MS,
    [],
  );

  const selected = scenarios?.find((s) => s.id === selectedId);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Scenarios"
        description="Select, run, and monitor SUMO traffic scenarios."
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
    </div>
  );
}
