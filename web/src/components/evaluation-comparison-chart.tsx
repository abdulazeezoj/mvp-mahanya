"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

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

// avgWaitingTimeSec, avgQueueLength, and priorityResponseTimeSec share
// comparable small-number scales, so they're safe to plot together. See the
// dedicated panel below for throughputVehPerHour, whose much larger absolute
// values would otherwise flatten these three bars to invisibility.
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

  const throughputData = [
    {
      name: "Intelligent controller",
      value: intelligent ? Number(intelligent.throughputVehPerHour) : 0,
      fill: "var(--color-intelligent)",
    },
    {
      name: "Fixed-time baseline",
      value: fixedTime ? Number(fixedTime.throughputVehPerHour) : 0,
      fill: "var(--color-fixedTime)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Intelligent vs. Fixed-Time
          </CardTitle>
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
              <Bar
                dataKey="fixedTime"
                fill="var(--color-fixedTime)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Throughput
          </CardTitle>
          <CardDescription>
            Higher is better. Plotted on its own axis so it isn't crushed by the
            time-based metrics at left.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[280px] w-full"
          >
            <BarChart
              data={throughputData}
              layout="vertical"
              margin={{ left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={100}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={<ChartTooltipContent hideLabel />}
                formatter={(value) => `${Number(value).toLocaleString()} veh/h`}
              />
              <Bar dataKey="value" radius={4}>
                {throughputData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
