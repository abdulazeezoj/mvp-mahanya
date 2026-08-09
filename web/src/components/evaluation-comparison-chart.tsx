"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { EvaluationMetrics } from "@/lib/types";

const chartConfig = {
  intelligent: {
    label: "Intelligent controller",
    color: "var(--primary)",
  },
  fixedTime: {
    label: "Fixed-time baseline",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

const METRIC_DEFS: {
  key: keyof EvaluationMetrics;
  label: string;
}[] = [
  { key: "avgWaitingTimeSec", label: "Avg. wait (s)" },
  { key: "avgQueueLength", label: "Avg. queue (veh)" },
  { key: "priorityResponseTimeSec", label: "Priority response (s)" },
];

export function EvaluationComparisonChart({
  intelligent,
  fixedTime,
}: {
  intelligent: EvaluationMetrics | undefined;
  fixedTime: EvaluationMetrics | undefined;
}) {
  const data = METRIC_DEFS.map(({ key, label }) => ({
    metric: label,
    intelligent: intelligent ? Number(intelligent[key]) : 0,
    fixedTime: fixedTime ? Number(fixedTime[key]) : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intelligent vs. Fixed-Time</CardTitle>
        <CardDescription>
          Lower is better on every metric shown here.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] w-full"
        >
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="metric"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="intelligent"
              fill="var(--color-intelligent)"
              radius={4}
            />
            <Bar dataKey="fixedTime" fill="var(--color-fixedTime)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
