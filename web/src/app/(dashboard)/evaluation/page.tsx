import { EvaluationTrendChart } from "@/components/evaluation-trend-chart";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mockEvaluationMetrics } from "@/lib/mock-data";

const METRICS: {
  key: keyof (typeof mockEvaluationMetrics)[number];
  label: string;
  unit: string;
  format?: (value: number) => string;
}[] = [
  { key: "avgWaitingTimeSec", label: "Avg. Waiting Time", unit: "s" },
  { key: "avgQueueLength", label: "Avg. Queue Length", unit: "veh" },
  { key: "throughputVehPerHour", label: "Throughput", unit: "veh/h" },
  {
    key: "priorityResponseTimeSec",
    label: "Priority Response Time",
    unit: "s",
  },
];

export default function EvaluationPage() {
  const scenarioId = mockEvaluationMetrics[0]?.scenarioId;
  const intelligent = mockEvaluationMetrics.find(
    (m) => m.scenarioId === scenarioId && m.controller === "intelligent",
  );
  const fixedTime = mockEvaluationMetrics.find(
    (m) => m.scenarioId === scenarioId && m.controller === "fixed-time",
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map(({ key, label, unit }) => {
          const intelligentValue = intelligent?.[key] as number | undefined;
          const fixedTimeValue = fixedTime?.[key] as number | undefined;
          return (
            <Card key={key}>
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  {intelligentValue ?? "—"} {unit}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Fixed-time baseline: {fixedTimeValue ?? "—"} {unit}
                </span>
              </CardHeader>
            </Card>
          );
        })}
      </div>
      <EvaluationTrendChart />
    </div>
  );
}
