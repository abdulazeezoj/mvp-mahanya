"use client";

import * as React from "react";

import { ScenarioControls } from "@/components/scenario-controls";
import { ScenarioList } from "@/components/scenario-list";
import { mockScenarios } from "@/lib/mock-data";

export default function ScenariosPage() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ScenarioControls scenarioId={selectedId} />
      <ScenarioList
        scenarios={mockScenarios}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}
