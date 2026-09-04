import type {
  ApproachDirection,
  ApproachState,
  LaneGeometry,
  NetworkBounds,
  NetworkGeometry,
  Phase,
  TrafficState,
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
  /** The lane's stop line, where the inbound lane meets the junction. SUMO map space. */
  stop: [number, number];
  /** Unit vector along the lane's travel direction (into the junction), SUMO map space. */
  direction: [number, number];
}

/**
 * Each approach's stop line and travel direction, in SUMO map space:
 * everything needed to draw a signal indicator bar directly across the
 * lane at the stop line, the way SUMO-GUI itself renders a traffic light
 * state (a short colored bar at the connection, not a free-standing
 * housing beside the road).
 */
export function signalPositions(
  geometry: NetworkGeometry,
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

    positions[direction] = { stop: inner, direction: [dx, dy] };
  }
  return positions;
}

export interface CrosswalkAnchor {
  /** Stripe-band center point, in SUMO map space. */
  center: [number, number];
  /** Unit vector along the lane's travel direction (into the junction), SUMO map space. */
  direction: [number, number];
  /** Unit vector across the lane (perpendicular to travel), SUMO map space. */
  perpendicular: [number, number];
}

/**
 * A zebra-crossing anchor per approach, `distance` map-space units out from
 * the junction center along that arm, the same "distance from center"
 * convention `directionLabelAnchors` already uses, deliberately *not*
 * relative to the real inbound lane's own (tiny, close-to-center) stop
 * line: the drawn carriageway and pavement plaza are a cosmetic widening
 * anchored on the junction center (see `LANES_PER_DIRECTION` in the
 * canvas), so a crossing positioned relative to the real stop line would
 * land deep inside that cosmetic plaza instead of out on the open road
 * past it. Direction/perpendicular still come from the real inbound
 * lane's own centerline, for orientation only.
 */
export function crosswalkAnchors(
  geometry: NetworkGeometry,
  distance: number,
): Partial<Record<ApproachDirection, CrosswalkAnchor>> {
  const center = junctionCenter(geometry);
  const anchors: Partial<Record<ApproachDirection, CrosswalkAnchor>> = {};
  for (const direction of DIRECTIONS) {
    const outward = armOutward(geometry, direction);
    if (!outward) continue;
    const [ox, oy] = outward;
    // Travel direction (into the junction) is the reverse of outward.
    const dx = -ox;
    const dy = -oy;
    const px = -dy;
    const py = dx;

    anchors[direction] = {
      center: [center.x + ox * distance, center.y + oy * distance],
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

/** Of the two perpendiculars of each vector, pick whichever pair points most nearly the same way, i.e. the shared edge between two adjacent arms. */
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
 * corners rounded, instead of a plain circle, which either leaves the
 * road ribbons' square corners exposed or balloons into a roundabout-like
 * blob unrelated to the real road edges. SUMO map space; pass through
 * `roundShape`-style rendering with each point's own `radius`.
 *
 * Returns one 3-point run per approach direction (outer corner shared
 * with the previous arm, outer corner shared with the next arm, the
 * rounded concave notch between this arm and the next), in a consistent
 * winding order; empty if fewer than two directions have an inbound
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

/**
 * All vehicle shapes are plain axis-aligned rectangles, matching how SUMO
 * itself renders vehicles from directly overhead, sized differently per
 * type so they stay visually distinguishable without needing an outline
 * silhouette (a rounded "nose" reads as a video-game car, not a simulator
 * replay).
 */
function rectangleShape(halfWidth: number, half: number): [number, number][] {
  return polygon([
    [-halfWidth, -half],
    [halfWidth, -half],
    [halfWidth, half],
    [-halfWidth, half],
  ]);
}

export function carShape(size: number): [number, number][] {
  return rectangleShape(size * 0.5, size * 0.85);
}

export function motorcycleShape(size: number): [number, number][] {
  return rectangleShape(size * 0.26, size * 0.7);
}

export function busShape(size: number): [number, number][] {
  return rectangleShape(size * 0.56, size * 1.3);
}

export function truckShape(size: number): [number, number][] {
  return rectangleShape(size * 0.5, size * 1.15);
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

export const DIRECTION_LABEL: Record<ApproachDirection, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
};

export const DIRECTION_SHORT_LABEL: Record<ApproachDirection, string> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
};

/** Outward (away-from-center) unit vector for the given direction's inbound lane, SUMO map space; undefined if that approach has no inbound lane. */
function armOutward(
  geometry: NetworkGeometry,
  direction: ApproachDirection,
): [number, number] | undefined {
  const inLane = geometry.lanes.find(
    (lane) => lane.direction === direction && lane.kind === "in",
  );
  if (!inLane) return undefined;
  const outer = outerEndpoint(inLane);
  const inner = innerEndpoint(inLane);
  if (!outer || !inner) return undefined;
  const tx = inner[0] - outer[0];
  const ty = inner[1] - outer[1];
  const length = Math.hypot(tx, ty) || 1;
  return [-tx / length, -ty / length];
}

/**
 * A label anchor per approach direction, set back from the junction center
 * along that arm and offset sideways off the road into the grass, for
 * "North"/"South"/... captions that sit beside the carriageway instead of
 * printed on top of the lane markings. SUMO map space. `lateralOffset`
 * defaults to 0 (directly on the centerline) for callers that don't need
 * the sideways shift.
 */
export function directionLabelAnchors(
  geometry: NetworkGeometry,
  distance: number,
  lateralOffset = 0,
): Partial<Record<ApproachDirection, ScenePoint>> {
  const center = junctionCenter(geometry);
  const anchors: Partial<Record<ApproachDirection, ScenePoint>> = {};
  for (const direction of DIRECTIONS) {
    const outward = armOutward(geometry, direction);
    if (!outward) continue;
    const [ox, oy] = outward;
    // Perpendicular to the arm, so the label sits beside the road rather
    // than on its centerline.
    const px = -oy;
    const py = ox;
    anchors[direction] = {
      x: center.x + ox * distance + px * lateralOffset,
      y: center.y + oy * distance + py * lateralOffset,
    };
  }
  return anchors;
}

/**
 * How congested a single approach reads, 0 (free-flowing) to 1 (saturated):
 * driven primarily by queue length, falling back to a damped vehicle count
 * when nothing is formally queued yet. Purely a rendering heuristic (lane
 * tint), not a scheduler input.
 */
const CONGESTION_QUEUE_SATURATION = 8;

export function congestionLevel(
  approach: Pick<ApproachState, "queueLength" | "vehicleCount">,
): number {
  const raw =
    approach.queueLength > 0
      ? approach.queueLength
      : approach.vehicleCount * 0.5;
  return Math.max(0, Math.min(1, raw / CONGESTION_QUEUE_SATURATION));
}

const CONGESTION_STOPS: [number, [number, number, number]][] = [
  [0, [34, 197, 94]], // free-flowing: green-500
  [0.5, [234, 179, 8]], // building: amber-500
  [1, [239, 68, 68]], // saturated: red-500
];

/** Green -> amber -> red blend for a 0..1 congestion level, as 0xRRGGBB. */
export function congestionColor(level: number): number {
  const clamped = Math.max(0, Math.min(1, level));
  let lo = CONGESTION_STOPS[0];
  let hi = CONGESTION_STOPS[CONGESTION_STOPS.length - 1];
  for (let i = 0; i < CONGESTION_STOPS.length - 1; i++) {
    if (
      clamped >= CONGESTION_STOPS[i][0] &&
      clamped <= CONGESTION_STOPS[i + 1][0]
    ) {
      lo = CONGESTION_STOPS[i];
      hi = CONGESTION_STOPS[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const t = (clamped - lo[0]) / span;
  const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t);
  const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t);
  const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t);
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

/** Every approach direction that currently has an emergency vehicle present. */
export function emergencyDirections(
  trafficState: TrafficState,
): ApproachDirection[] {
  return DIRECTIONS.filter(
    (direction) => trafficState.approaches[direction]?.hasEmergencyVehicle,
  );
}
