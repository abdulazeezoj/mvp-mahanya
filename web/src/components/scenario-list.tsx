"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Scenario } from "@/lib/types";

const STATUS_VARIANT: Record<
  Scenario["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  idle: "outline",
  running: "default",
  paused: "secondary",
  completed: "secondary",
};

export function ScenarioPicker({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = scenarios.find((s) => s.id === selectedId);

  return (
    <Select
      value={selectedId}
      onValueChange={(value) => value && onSelect(value)}
    >
      <SelectTrigger className="w-56" aria-label="Select scenario">
        <SelectValue placeholder="Select a scenario">
          {() =>
            selected ? (
              <span className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
                <span className="truncate">{selected.name}</span>
                <Badge variant={STATUS_VARIANT[selected.status]}>
                  {selected.status}
                </Badge>
              </span>
            ) : (
              "Select a scenario"
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {scenarios.map((scenario) => (
          <SelectItem key={scenario.id} value={scenario.id}>
            <span className="flex flex-1 items-center justify-between gap-2">
              <span className="flex flex-col">
                <span>{scenario.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  Seed {scenario.seed}
                </span>
              </span>
              <Badge variant={STATUS_VARIANT[scenario.status]}>
                {scenario.status}
              </Badge>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
