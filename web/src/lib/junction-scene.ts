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
  /** Unit vector along the lane's travel direction (into the junction), SUMO map space — the housing's long side is rotated to run parallel to this. */
  direction: [number, number];
}

/** Perpendicular-offset light placement beside (clear of) the lane, near the stop line, in SUMO map space. */
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
    // Clears the road's own half-width plus the crossing road's ribbon
    // near the junction mouth, so the housing stands fully off the
    // pavement rather than overlapping its edge.
    const lateralOffset = roadWidth * 1.7;
    const setback = roadWidth * 0.4;

    const light: [number, number] = [
      inner[0] + px * lateralOffset - dx * setback,
      inner[1] + py * lateralOffset - dy * setback,
    ];
    positions[direction] = { light, stop: inner, direction: [dx, dy] };
  }
  return positions;
}

export interface CrosswalkAnchor {
  /** Stripe-band center point, in SUMO map space. */
  center: [number, number];
  /** Unit vector along the lane's travel direction (into the junction), SUMO map space. */
  direction: [number, number];
  /** Unit vector across the lane, SUMO map space. */
  perpendicular: [number, number];
}

/** A zebra-crossing anchor just outside the junction mouth, one per approach with an inbound lane. */
export function crosswalkAnchors(
  geometry: NetworkGeometry,
  roadWidth: number,
): Partial<Record<ApproachDirection, CrosswalkAnchor>> {
  const anchors: Partial<Record<ApproachDirection, CrosswalkAnchor>> = {};
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

    const setback = roadWidth * 1.3;
    const center: [number, number] = [
      inner[0] - dx * setback,
      inner[1] - dy * setback,
    ];
    anchors[direction] = {
      center,
      direction: [dx, dy],
      perpendicular: [px, py],
    };
  }
  return anchors;
}

export interface JunctionPavementPoint {
  x: number;
  y: number;
  radius: number;
}

function rotate90(v: [number, number], ccw: boolean): [number, number] {
  const [x, y] = v;
  return ccw ? [-y, x] : [y, -x];
}

/** Of the two perpendiculars of each vector, pick whichever pair points most nearly the same way — i.e. the shared edge between two adjacent arms. */
function facingPerpendiculars(
  outwardA: [number, number],
  outwardB: [number, number],
): { perpA: [number, number]; perpB: [number, number] } {
  const candidatesA: [number, number][] = [
    rotate90(outwardA, true),
    rotate90(outwardA, false),
  ];
  const candidatesB: [number, number][] = [
    rotate90(outwardB, true),
    rotate90(outwardB, false),
  ];
  let best = { perpA: candidatesA[0], perpB: candidatesB[0] };
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const perpA of candidatesA) {
    for (const perpB of candidatesB) {
      const score = perpA[0] * perpB[0] + perpA[1] * perpB[1];
      if (score > bestScore) {
        bestScore = score;
        best = { perpA, perpB };
      }
    }
  }
  return best;
}

/**
 * The paved-area outline at the junction mouth: a "plus" shape following
 * where each arm's road actually meets its neighbors, with its concave
 * corners rounded — instead of a plain circle, which either leaves the
 * road ribbons' square corners exposed or balloons into a roundabout-like
 * blob unrelated to the real road edges. SUMO map space; pass through
 * `roundShape`-style rendering with each point's own `radius`.
 *
 * Returns one 3-point run per approach direction (outer corner shared
 * with the previous arm, outer corner shared with the next arm, the
 * rounded concave notch between this arm and the next), in a consistent
 * winding order — empty if fewer than two directions have an inbound
 * lane, since a "junction" needs at least two roads meeting.
 */
export function junctionPavementOutline(
  geometry: NetworkGeometry,
  roadWidth: number,
  armReach: number,
  cornerRadius: number,
): JunctionPavementPoint[] {
  const center = junctionCenter(geometry);
  const arms: { outward: [number, number]; angle: number }[] = [];
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
    // Outward: away from the junction center, the opposite of the
    // inbound lane's into-the-junction travel direction.
    const outward: [number, number] = [-tx / length, -ty / length];
    arms.push({ outward, angle: Math.atan2(outward[1], outward[0]) });
  }
  if (arms.length < 2) return [];
  arms.sort((a, b) => a.angle - b.angle);

  const halfWidth = roadWidth / 2;
  const notches: [number, number][] = arms.map((arm, i) => {
    const next = arms[(i + 1) % arms.length];
    const { perpA, perpB } = facingPerpendiculars(arm.outward, next.outward);
    return [
      center.x + perpA[0] * halfWidth + perpB[0] * halfWidth,
      center.y + perpA[1] * halfWidth + perpB[1] * halfWidth,
    ];
  });

  const points: JunctionPavementPoint[] = [];
  for (let i = 0; i < arms.length; i++) {
    const prevNotch = notches[(i - 1 + arms.length) % arms.length];
    const nextNotch = notches[i];
    const [ox, oy] = arms[i].outward;
    points.push({
      x: prevNotch[0] + ox * armReach,
      y: prevNotch[1] + oy * armReach,
      radius: 0,
    });
    points.push({
      x: nextNotch[0] + ox * armReach,
      y: nextNotch[1] + oy * armReach,
      radius: 0,
    });
    points.push({ x: nextNotch[0], y: nextNotch[1], radius: cornerRadius });
  }
  return points;
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
