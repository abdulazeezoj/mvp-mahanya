import type {
  ApproachDirection,
  LaneGeometry,
  NetworkBounds,
  NetworkGeometry,
  Phase,
  VehicleType,
} from "@/lib/types";

export const DIRECTIONS: ApproachDirection[] = [
  "north",
  "south",
  "east",
  "west",
];

export const VEHICLE_TYPES: VehicleType[] = [
  "car",
  "motorcycle",
  "bus",
  "truck",
  "emergency",
];

export const VEHICLE_LABEL: Record<VehicleType, string> = {
  car: "Car",
  motorcycle: "Motorcycle",
  bus: "Bus",
  truck: "Truck",
  emergency: "Emergency vehicle",
};

export const VEHICLE_SIZE_SCALE: Record<VehicleType, number> = {
  car: 1,
  motorcycle: 0.6,
  bus: 2.1,
  truck: 1.9,
  emergency: 1.25,
};

export interface ScenePoint {
  x: number;
  y: number;
}

export function innerEndpoint(
  lane: LaneGeometry,
): [number, number] | undefined {
  if (lane.shape.length === 0) return undefined;
  return lane.kind === "in" ? lane.shape[lane.shape.length - 1] : lane.shape[0];
}

export function outerEndpoint(
  lane: LaneGeometry,
): [number, number] | undefined {
  if (lane.shape.length === 0) return undefined;
  return lane.kind === "in" ? lane.shape[0] : lane.shape[lane.shape.length - 1];
}

export function junctionCenter(geometry: NetworkGeometry): ScenePoint {
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

/** Map SUMO map-space (Y-up) coordinates into scene space (Y-down, origin at bounds.min). */
export function toSceneSpace(
  bounds: NetworkBounds,
  [x, y]: [number, number],
): [number, number] {
  return [x - bounds.minX, bounds.maxY - y];
}

export interface SignalPosition {
  light: [number, number];
  stop: [number, number];
}

/** Perpendicular-offset light placement beside the lane, near the stop line, in SUMO map space. */
export function signalPositions(
  geometry: NetworkGeometry,
  roadWidth: number,
): Partial<Record<ApproachDirection, SignalPosition>> {
  const positions: Partial<Record<ApproachDirection, SignalPosition>> = {};
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

    const light: [number, number] = [
      inner[0] + px * lateralOffset - dx * setback,
      inner[1] + py * lateralOffset - dy * setback,
    ];
    positions[direction] = { light, stop: inner };
  }
  return positions;
}

export function signalStateFor(
  direction: ApproachDirection,
  activePhase: Phase | undefined,
): "red" | "yellow" | "green" {
  if (!activePhase) return "red";
  const prefix = direction.toUpperCase();
  if (activePhase === `${prefix}_GREEN`) return "green";
  if (activePhase === `${prefix}_YELLOW`) return "yellow";
  return "red";
}

/**
 * Offset a (possibly multi-point) lane centerline into a filled ribbon
 * polygon of the given width, using the averaged incoming/outgoing segment
 * normal at each interior point. Good enough for this network's mostly
 * straight lanes; not a general miter-join implementation.
 */
export function offsetRibbon(
  shape: [number, number][],
  width: number,
): [number, number][] {
  if (shape.length < 2) return [];
  const half = width / 2;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < shape.length; i++) {
    const prev = shape[i - 1];
    const curr = shape[i];
    const next = shape[i + 1];
    let dx = 0;
    let dy = 0;
    if (prev) {
      dx += curr[0] - prev[0];
      dy += curr[1] - prev[1];
    }
    if (next) {
      dx += next[0] - curr[0];
      dy += next[1] - curr[1];
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push([curr[0] + nx * half, curr[1] + ny * half]);
    right.push([curr[0] - nx * half, curr[1] - ny * half]);
  }
  return [...left, ...right.reverse()];
}

function polygon(points: [number, number][]): [number, number][] {
  return points;
}

export function carShape(size: number): [number, number][] {
  const halfWidth = size * 0.62;
  const nose = -size;
  const shoulder = -size * 0.5;
  const tail = size * 0.75;
  return polygon([
    [0, nose],
    [halfWidth, shoulder],
    [halfWidth, tail],
    [-halfWidth, tail],
    [-halfWidth, shoulder],
  ]);
}

export function motorcycleShape(size: number): [number, number][] {
  const halfWidth = size * 0.3;
  const nose = -size;
  const shoulder = -size * 0.1;
  const tail = size * 0.8;
  return polygon([
    [0, nose],
    [halfWidth, shoulder],
    [halfWidth * 0.7, tail],
    [-halfWidth * 0.7, tail],
    [-halfWidth, shoulder],
  ]);
}

export function busShape(size: number): [number, number][] {
  const halfWidth = size * 0.55;
  const nose = -size;
  const shoulder = -size * 0.7;
  const tail = size * 0.9;
  return polygon([
    [-halfWidth * 0.75, nose],
    [halfWidth * 0.75, nose],
    [halfWidth, shoulder],
    [halfWidth, tail],
    [-halfWidth, tail],
    [-halfWidth, shoulder],
  ]);
}

export function truckShape(size: number): [number, number][] {
  const cabHalf = size * 0.42;
  const boxHalf = size * 0.52;
  const nose = -size;
  const cabEnd = -size * 0.45;
  const tail = size * 0.95;
  return polygon([
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

export const VEHICLE_SHAPE: Record<
  VehicleType,
  (size: number) => [number, number][]
> = {
  car: carShape,
  motorcycle: motorcycleShape,
  bus: busShape,
  truck: truckShape,
  emergency: carShape,
};
