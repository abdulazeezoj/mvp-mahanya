"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { mockEvaluationTrend } from "@/lib/mock-data";

const chartConfig = {
  intelligentWaitingTimeSec: {
    label: "Intelligent controller",
    color: "var(--primary)",
  },
  fixedTimeWaitingTimeSec: {
    label: "Fixed-time baseline",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

export function EvaluationTrendChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Waiting Time</CardTitle>
        <CardDescription>
          Intelligent controller vs. fixed-time baseline over the run
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={mockEvaluationTrend}>
            <defs>
              <linearGradient id="fillIntelligent" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-intelligentWaitingTimeSec)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-intelligentWaitingTimeSec)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillFixedTime" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-fixedTimeWaitingTimeSec)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-fixedTimeWaitingTimeSec)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="tick"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `t${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="fixedTimeWaitingTimeSec"
              type="natural"
              fill="url(#fillFixedTime)"
              stroke="var(--color-fixedTimeWaitingTimeSec)"
              stackId="a"
            />
            <Area
              dataKey="intelligentWaitingTimeSec"
              type="natural"
              fill="url(#fillIntelligent)"
              stroke="var(--color-intelligentWaitingTimeSec)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
