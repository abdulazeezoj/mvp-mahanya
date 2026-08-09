"use client";

import { motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  VEHICLE_LABEL,
  VEHICLE_SHAPE,
  VEHICLE_SIZE_SCALE,
  VEHICLE_TYPES,
} from "@/lib/junction-scene";
import type { NetworkGeometry, TrafficState, VehicleType } from "@/lib/types";

const VEHICLE_FILL: Partial<Record<VehicleType, string>> = {
  emergency: "#ef4444",
};

const JunctionPixiCanvas = dynamic(
  () => import("./junction-pixi-canvas").then((mod) => mod.JunctionPixiCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square w-full max-w-3xl animate-pulse rounded-lg border border-border bg-muted/30" />
    ),
  },
);

export function JunctionSimulationView({
  geometry,
  trafficState,
}: {
  geometry: NetworkGeometry | null;
  trafficState: TrafficState | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
          Live Junction
          {trafficState && (
            <motion.span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{
                duration: 1.6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          )}
        </CardTitle>
        <CardDescription>
          The Sapon Under-bridge Junction, rendered from live SUMO vehicle
          positions
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!geometry ? (
          <p className="text-xs text-muted-foreground">
            Loading junction geometry…
          </p>
        ) : (
          <>
            <div role="img" aria-label="Live junction simulation">
              <JunctionPixiCanvas
                geometry={geometry}
                trafficState={trafficState}
              />
              <span className="sr-only">
                {trafficState
                  ? `${trafficState.vehicles.length} vehicles on the junction, active phase ${trafficState.activePhase}`
                  : "Junction idle, no live traffic state"}
              </span>
            </div>
            <VehicleLegend />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function VehicleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {VEHICLE_TYPES.map((type) => (
        <div key={type} className="flex items-center gap-1.5">
          <svg
            viewBox="-10 -10 20 20"
            className={
              type === "emergency" ? "size-3.5" : "size-3.5 text-foreground/70"
            }
          >
            <polygon
              points={VEHICLE_SHAPE[type](8 * VEHICLE_SIZE_SCALE[type] * 0.5)
                .map((p) => p.join(","))
                .join(" ")}
              fill={VEHICLE_FILL[type] ?? "currentColor"}
            />
            {type === "emergency" && (
              <circle cx={0} cy={-1.2} r={2.2} fill="#3b82f6" />
            )}
          </svg>
          {VEHICLE_LABEL[type]}
        </div>
      ))}
    </div>
  );
}
