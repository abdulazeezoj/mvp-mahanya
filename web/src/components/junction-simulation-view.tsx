"use client";

import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ApproachDirection,
  LaneGeometry,
  NetworkGeometry,
  Phase,
  TrafficState,
} from "@/lib/types";

const DIRECTIONS: ApproachDirection[] = ["north", "south", "east", "west"];

const SIGNAL_COLOR: Record<"red" | "yellow" | "green", string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
};

function signalStateFor(
  direction: ApproachDirection,
  activePhase: Phase | undefined,
): "red" | "yellow" | "green" {
  if (!activePhase) return "red";
  const prefix = direction.toUpperCase();
  if (activePhase === `${prefix}_GREEN`) return "green";
  if (activePhase === `${prefix}_YELLOW`) return "yellow";
  return "red";
}

interface Point {
  x: number;
  y: number;
}

function innerEndpoint(lane: LaneGeometry): [number, number] | undefined {
  if (lane.shape.length === 0) return undefined;
  return lane.kind === "in" ? lane.shape[lane.shape.length - 1] : lane.shape[0];
}

function outerEndpoint(lane: LaneGeometry): [number, number] | undefined {
  if (lane.shape.length === 0) return undefined;
  return lane.kind === "in" ? lane.shape[0] : lane.shape[lane.shape.length - 1];
}

function junctionCenter(geometry: NetworkGeometry): Point {
  const inner = geometry.lanes
    .map(innerEndpoint)
    .filter((p): p is [number, number] => p !== undefined);
  if (inner.length === 0) {
    return {
      x: (geometry.bounds.minX + geometry.bounds.maxX) / 2,
      y: (geometry.bounds.minY + geometry.bounds.maxY) / 2,
    };
  }
  const sum = inner.reduce((acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / inner.length, y: sum.y / inner.length };
}

function laneCenterlinePath(
  lane: LaneGeometry,
  toSvg: (pt: [number, number]) => [number, number],
): string {
  return lane.shape
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${toSvg(pt).join(",")}`)
    .join(" ");
}

function carPolygonPoints(size: number): string {
  const halfWidth = size * 0.62;
  const nose = -size;
  const shoulder = -size * 0.5;
  const tail = size * 0.75;
  return [
    [0, nose],
    [halfWidth, shoulder],
    [halfWidth, tail],
    [-halfWidth, tail],
    [-halfWidth, shoulder],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

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
      <CardContent>
        {!geometry ? (
          <p className="text-xs text-muted-foreground">
            Loading junction geometry…
          </p>
        ) : (
          <JunctionSvg geometry={geometry} trafficState={trafficState} />
        )}
      </CardContent>
    </Card>
  );
}

function JunctionSvg({
  geometry,
  trafficState,
}: {
  geometry: NetworkGeometry;
  trafficState: TrafficState | null;
}) {
  const { bounds } = geometry;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const extent = Math.max(width, height);
  const roadWidth = extent * 0.05;
  const plazaRadius = extent * 0.07;
  const lightRadius = extent * 0.02;

  const toSvg = React.useCallback(
    ([x, y]: [number, number]): [number, number] => [
      x - bounds.minX,
      bounds.maxY - y,
    ],
    [bounds],
  );

  const center = React.useMemo(() => junctionCenter(geometry), [geometry]);
  const centerSvg = toSvg([center.x, center.y]);

  const lightPositions = React.useMemo(() => {
    const positions: Partial<Record<ApproachDirection, [number, number]>> = {};
    for (const direction of DIRECTIONS) {
      const inLane = geometry.lanes.find(
        (lane) => lane.direction === direction && lane.kind === "in",
      );
      const outer = inLane ? outerEndpoint(inLane) : undefined;
      if (!outer) continue;
      const dx = outer[0] - center.x;
      const dy = outer[1] - center.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const distance = plazaRadius + lightRadius * 2.5;
      positions[direction] = toSvg([
        center.x + ux * distance,
        center.y + uy * distance,
      ]);
    }
    return positions;
  }, [geometry, center, plazaRadius, lightRadius, toSvg]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="aspect-square w-full max-w-md rounded-lg border border-border bg-muted/30"
      role="img"
      aria-label="Live junction simulation"
    >
      <defs>
        <radialGradient id="junction-plaza-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
        </radialGradient>
      </defs>

      {geometry.lanes.map((lane) => (
        <polyline
          key={lane.id}
          points={lane.shape.map((pt) => toSvg(pt).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground/40"
          strokeWidth={roadWidth}
          strokeLinecap="round"
        />
      ))}

      {geometry.lanes.map((lane) => (
        <path
          key={`${lane.id}-centerline`}
          d={laneCenterlinePath(lane, toSvg)}
          fill="none"
          stroke="currentColor"
          className="text-background/70"
          strokeWidth={roadWidth * 0.06}
          strokeDasharray={`${roadWidth * 0.4} ${roadWidth * 0.5}`}
        />
      ))}

      <circle
        cx={centerSvg[0]}
        cy={centerSvg[1]}
        r={plazaRadius}
        fill="url(#junction-plaza-gradient)"
        className="text-muted-foreground"
      />

      {DIRECTIONS.map((direction) => {
        const pos = lightPositions[direction];
        if (!pos) return null;
        const state = signalStateFor(direction, trafficState?.activePhase);
        const isActive = state !== "red";
        return (
          <g key={direction}>
            {isActive && (
              <motion.circle
                cx={pos[0]}
                cy={pos[1]}
                r={lightRadius * 2.2}
                fill={SIGNAL_COLOR[state]}
                style={{ filter: "blur(6px)" }}
                animate={{ opacity: [0.5, 0.85, 0.5] }}
                transition={{
                  duration: 1.2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              />
            )}
            <motion.circle
              cx={pos[0]}
              cy={pos[1]}
              r={lightRadius}
              animate={{ fill: SIGNAL_COLOR[state] }}
              transition={{ duration: 0.4 }}
              stroke="currentColor"
              className="text-background"
              strokeWidth={lightRadius * 0.3}
            />
          </g>
        );
      })}

      <AnimatePresence>
        {trafficState?.vehicles.map((vehicle) => {
          const [sx, sy] = toSvg([vehicle.x, vehicle.y]);
          const size = vehicle.isEmergency ? extent * 0.024 : extent * 0.017;
          return (
            <motion.g
              key={vehicle.vehicleId}
              initial={{
                opacity: 0,
                scale: 0.4,
                x: sx,
                y: sy,
                rotate: vehicle.angleDeg,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: sx,
                y: sy,
                rotate: vehicle.angleDeg,
              }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            >
              <polygon
                points={carPolygonPoints(size)}
                fill={vehicle.isEmergency ? "#ef4444" : "currentColor"}
                className={
                  vehicle.isEmergency ? undefined : "text-foreground/70"
                }
              />
              {vehicle.isEmergency && (
                <motion.circle
                  cx={0}
                  cy={-size * 0.15}
                  r={size * 0.28}
                  animate={{
                    fill: ["#ef4444", "#3b82f6", "#ef4444"],
                    opacity: [1, 0.5, 1],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
