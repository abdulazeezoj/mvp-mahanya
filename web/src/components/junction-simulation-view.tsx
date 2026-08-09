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
  VehicleType,
} from "@/lib/types";

const DIRECTIONS: ApproachDirection[] = ["north", "south", "east", "west"];
const VEHICLE_TYPES: VehicleType[] = [
  "car",
  "motorcycle",
  "bus",
  "truck",
  "emergency",
];

const SIGNAL_COLOR: Record<"red" | "yellow" | "green", string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
};

const VEHICLE_LABEL: Record<VehicleType, string> = {
  car: "Car",
  motorcycle: "Motorcycle",
  bus: "Bus",
  truck: "Truck",
  emergency: "Emergency vehicle",
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

function polygonPoints(points: [number, number][]): string {
  return points.map((p) => p.join(",")).join(" ");
}

function carPolygonPoints(size: number): string {
  const halfWidth = size * 0.62;
  const nose = -size;
  const shoulder = -size * 0.5;
  const tail = size * 0.75;
  return polygonPoints([
    [0, nose],
    [halfWidth, shoulder],
    [halfWidth, tail],
    [-halfWidth, tail],
    [-halfWidth, shoulder],
  ]);
}

function motorcyclePolygonPoints(size: number): string {
  const halfWidth = size * 0.3;
  const nose = -size;
  const shoulder = -size * 0.1;
  const tail = size * 0.8;
  return polygonPoints([
    [0, nose],
    [halfWidth, shoulder],
    [halfWidth * 0.7, tail],
    [-halfWidth * 0.7, tail],
    [-halfWidth, shoulder],
  ]);
}

function busPolygonPoints(size: number): string {
  const halfWidth = size * 0.55;
  const nose = -size;
  const shoulder = -size * 0.7;
  const tail = size * 0.9;
  return polygonPoints([
    [-halfWidth * 0.75, nose],
    [halfWidth * 0.75, nose],
    [halfWidth, shoulder],
    [halfWidth, tail],
    [-halfWidth, tail],
    [-halfWidth, shoulder],
  ]);
}

function truckPolygonPoints(size: number): string {
  const cabHalf = size * 0.42;
  const boxHalf = size * 0.52;
  const nose = -size;
  const cabEnd = -size * 0.45;
  const tail = size * 0.95;
  return polygonPoints([
    [-cabHalf, nose],
    [cabHalf, nose],
    [cabHalf, cabEnd],
    [boxHalf, cabEnd],
    [boxHalf, tail],
    [-boxHalf, tail],
    [-boxHalf, cabEnd],
    [-cabHalf, cabEnd],
  ]);
}

const VEHICLE_SHAPE: Record<VehicleType, (size: number) => string> = {
  car: carPolygonPoints,
  motorcycle: motorcyclePolygonPoints,
  bus: busPolygonPoints,
  truck: truckPolygonPoints,
  emergency: carPolygonPoints,
};

const VEHICLE_SIZE_SCALE: Record<VehicleType, number> = {
  car: 1,
  motorcycle: 0.6,
  bus: 2.1,
  truck: 1.9,
  emergency: 1.25,
};

const VEHICLE_FILL: Partial<Record<VehicleType, string>> = {
  emergency: "#ef4444",
};

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
            <JunctionSvg geometry={geometry} trafficState={trafficState} />
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
              points={VEHICLE_SHAPE[type](8 * VEHICLE_SIZE_SCALE[type] * 0.5)}
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
  const roadWidth = extent * 0.08;
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
    const positions: Partial<
      Record<
        ApproachDirection,
        { light: [number, number]; stop: [number, number] }
      >
    > = {};
    for (const direction of DIRECTIONS) {
      const inLane = geometry.lanes.find(
        (lane) => lane.direction === direction && lane.kind === "in",
      );
      if (!inLane) continue;
      const outer = outerEndpoint(inLane);
      const inner = innerEndpoint(inLane);
      if (!outer || !inner) continue;

      const tx = inner[0] - outer[0];
      const ty = inner[1] - outer[1];
      const length = Math.hypot(tx, ty) || 1;
      const dx = tx / length;
      const dy = ty / length;

      const px = -dy;
      const py = dx;
      const lateralOffset = roadWidth * 1.1;
      const setback = roadWidth * 0.4;

      const lightSumo: [number, number] = [
        inner[0] + px * lateralOffset - dx * setback,
        inner[1] + py * lateralOffset - dy * setback,
      ];
      positions[direction] = { light: toSvg(lightSumo), stop: toSvg(inner) };
    }
    return positions;
  }, [geometry, roadWidth, toSvg]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="aspect-square w-full max-w-3xl rounded-lg border border-border bg-muted/30"
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
            <line
              x1={pos.stop[0]}
              y1={pos.stop[1]}
              x2={pos.light[0]}
              y2={pos.light[1]}
              stroke="currentColor"
              className="text-muted-foreground/50"
              strokeWidth={lightRadius * 0.15}
            />
            {isActive && (
              <motion.circle
                cx={pos.light[0]}
                cy={pos.light[1]}
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
              cx={pos.light[0]}
              cy={pos.light[1]}
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
          const size = extent * 0.017 * VEHICLE_SIZE_SCALE[vehicle.vehicleType];
          const isEmergency = vehicle.vehicleType === "emergency";
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
                points={VEHICLE_SHAPE[vehicle.vehicleType](size)}
                fill={VEHICLE_FILL[vehicle.vehicleType] ?? "currentColor"}
                className={isEmergency ? undefined : "text-foreground/70"}
              />
              {isEmergency && (
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
