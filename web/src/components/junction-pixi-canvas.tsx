"use client";

import { Application, Container, Graphics, Text } from "pixi.js";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  congestionColor,
  congestionLevel,
  crosswalkAnchors,
  DIRECTION_LABEL,
  DIRECTIONS,
  directionLabelAnchors,
  junctionCenter,
  junctionPavementOutline,
  offsetRibbon,
  signalPositions,
  signalStateFor,
  toSceneSpace,
  VEHICLE_SHAPE,
  VEHICLE_SIZE_SCALE,
} from "@/lib/junction-scene";
import type {
  ApproachDirection,
  NetworkGeometry,
  TrafficState,
  VehicleType,
} from "@/lib/types";

// This canvas is a faithful, always-the-same-look replica of SUMO-GUI's own
// top-down rendering: green grass, dark asphalt, white lane paint, a short
// colored bar at each stop line for signal state, and flat yellow vehicle
// rectangles. None of that has a dark/light mode in the real tool, so none
// of it is resolved from the app's theme tokens here — these are fixed
// "real-world material" colors, same as a satellite photo doesn't change
// color when you toggle your OS theme.
const GRASS = 0x2f6b34;
const ASPHALT = 0x232326;
const ASPHALT_EDGE = 0x141416;
const ROAD_PAINT = 0xf2f2ef;
const SIGNAL_COLOR: Record<"red" | "yellow" | "green", number> = {
  red: 0xef4444,
  yellow: 0xeab308,
  green: 0x22c55e,
};
const VEHICLE_FILL = 0xffcc33;
const VEHICLE_OUTLINE = 0x3a2b00;
const EMERGENCY_FILL = 0xef4444;
const EMERGENCY_BEACON = [0xef4444, 0x3b82f6];
const LABEL_FILL = 0xffffff;
const LABEL_STROKE = 0x1a1a1a;

const TWEEN_MS = 900;
const EMERGENCY_BEACON_PERIOD_MS = 600;

// Typical single-approach green window used only to give the phase-elapsed
// indicator something to fill toward — a visual reference, not a scheduler
// bound (the scheduler's actual min/max green thresholds aren't part of
// TrafficState and shouldn't be guessed at here).
const PHASE_PROGRESS_REFERENCE_SEC = 30;

// Uniform shrink applied on top of the fit-to-canvas scale so the pavement
// never runs flush to the frame edge — leaves a grass margin on every side.
const FRAME_MARGIN = 0.9;

// The calibrated Sapon network models exactly one lane each way per
// approach — that's the real, simulated geometry, and vehicle positions
// always come from that single lane. LANES_PER_DIRECTION is a purely
// cosmetic widening of the drawn carriageway into a multi-lane road (the
// look of the reference SUMO-GUI capture this was redesigned to match),
// not a claim that the simulation itself models extra lanes.
const LANE_WIDTH_RATIO = 0.055;
const LANES_PER_DIRECTION = 3;

function laneWidthFor(bounds: NetworkGeometry["bounds"]): number {
  return (
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) *
    LANE_WIDTH_RATIO
  );
}

/** One direction's full lane block (all `LANES_PER_DIRECTION` lanes combined). */
function roadWidthFor(bounds: NetworkGeometry["bounds"]): number {
  return laneWidthFor(bounds) * LANES_PER_DIRECTION;
}

/**
 * The cosmetic pavement plaza's own size, shared between `drawStatic` (which
 * draws it) and `drawSignals` (which needs to know where its outer edge
 * is): the real network's inbound lanes connect only a few units from the
 * junction center, but the widened, multi-lane carriageway this canvas
 * draws is anchored on `armReach` out from the center instead — so
 * anything meant to sit "just past the plaza" (signal ticks, the
 * crosswalk) has to measure from the center + `armReach`, not from the
 * real, close-in stop line.
 */
function pavementGeometryFor(bounds: NetworkGeometry["bounds"]) {
  const roadWidth = roadWidthFor(bounds);
  return {
    roadWidth,
    armReach: roadWidth * 1.5,
    cornerRadius: roadWidth * 0.4,
  };
}

/**
 * The per-lane signal tick's own size, shared between `drawSignals` (which
 * draws the ticks) and `drawStatic` (which draws the lane arrows and
 * crosswalk right after them) so those line up exactly where the ticks
 * end. Each tick is laid crosswise over its own single lane — `span` is
 * how far it reaches across the lane (perpendicular to travel) and
 * `thickness` is how deep it is along the lane (parallel to travel, kept
 * small so it reads as a stop-line mark, not a speed bump).
 */
function signalTickGeometryFor(laneWidth: number) {
  return {
    span: laneWidth * 0.78,
    thickness: laneWidth * 0.32,
    gap: laneWidth * 0.22,
  };
}

/**
 * A lane-direction arrow's size — the shaft+head painted on each lane
 * between its signal tick and the crosswalk, showing which way that lane
 * travels (this network has no per-lane turn restrictions, so every lane
 * gets a straight-ahead arrow).
 */
function laneArrowGeometryFor(laneWidth: number) {
  return {
    length: laneWidth * 1.1,
    width: laneWidth * 0.5,
    gap: laneWidth * 0.35,
  };
}

/**
 * A straight-ahead lane arrow (shaft + triangular head) centered at
 * `center`, pointing along unit vector `dir`, `length` long and `width`
 * wide at the head — in the same space as `center` (map space; caller
 * converts through `toSceneSpace` before filling).
 */
function laneArrowPolygons(
  center: [number, number],
  dir: [number, number],
  perp: [number, number],
  length: number,
  width: number,
): { shaft: [number, number][]; head: [number, number][] } {
  const halfLen = length / 2;
  const headLen = length * 0.45;
  const shaftLen = length - headLen;
  const shaftWidth = width * 0.34;
  const shaftCenter: [number, number] = [
    center[0] + dir[0] * (-halfLen + shaftLen / 2),
    center[1] + dir[1] * (-halfLen + shaftLen / 2),
  ];
  const shaft = orientedRectCorners(
    shaftCenter,
    dir,
    perp,
    shaftLen,
    shaftWidth,
  );

  const apex: [number, number] = [
    center[0] + dir[0] * halfLen,
    center[1] + dir[1] * halfLen,
  ];
  const baseCenter: [number, number] = [
    center[0] + dir[0] * (halfLen - headLen),
    center[1] + dir[1] * (halfLen - headLen),
  ];
  const head: [number, number][] = [
    apex,
    [
      baseCenter[0] + perp[0] * (width / 2),
      baseCenter[1] + perp[1] * (width / 2),
    ],
    [
      baseCenter[0] - perp[0] * (width / 2),
      baseCenter[1] - perp[1] * (width / 2),
    ],
  ];
  return { shaft, head };
}

function toSceneSpaceRounded(
  bounds: NetworkGeometry["bounds"],
  point: { x: number; y: number; radius: number },
): { x: number; y: number; radius: number } {
  const [x, y] = toSceneSpace(bounds, [point.x, point.y]);
  return { x, y, radius: point.radius };
}

function fitTransform(
  canvasW: number,
  canvasH: number,
  sceneW: number,
  sceneH: number,
) {
  const scale =
    (Math.min(canvasW / sceneW, canvasH / sceneH) || 1) * FRAME_MARGIN;
  return {
    scale,
    offsetX: (canvasW - sceneW * scale) / 2,
    offsetY: (canvasH - sceneH * scale) / 2,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from + 180) % 360) + 540) % 360) - 180;
}

/** Perpendicular unit normal of a single straight segment (left of travel direction). */
function segmentNormal(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number] {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  return [-(y2 - y1) / len, (x2 - x1) / len];
}

/** A solid line offset perpendicular from a straight segment by `offset`. */
function drawOffsetSolidLine(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  width: number,
  color: number,
  alpha: number,
) {
  const [nx, ny] = segmentNormal(x1, y1, x2, y2);
  g.moveTo(x1 + nx * offset, y1 + ny * offset)
    .lineTo(x2 + nx * offset, y2 + ny * offset)
    .stroke({ width, color, alpha });
}

/** A dashed line offset perpendicular from a straight segment by `offset` — a lane-boundary marking. */
function drawOffsetDashedLine(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  dashLen: number,
  gapLen: number,
  width: number,
  color: number,
  alpha: number,
) {
  const [nx, ny] = segmentNormal(x1, y1, x2, y2);
  const ox1 = x1 + nx * offset;
  const oy1 = y1 + ny * offset;
  const ox2 = x2 + nx * offset;
  const oy2 = y2 + ny * offset;
  const segLen = Math.hypot(ox2 - ox1, oy2 - oy1);
  const dirX = (ox2 - ox1) / (segLen || 1);
  const dirY = (oy2 - oy1) / (segLen || 1);
  let travelled = 0;
  while (travelled < segLen) {
    const start = travelled;
    const end = Math.min(travelled + dashLen, segLen);
    g.moveTo(ox1 + dirX * start, oy1 + dirY * start)
      .lineTo(ox1 + dirX * end, oy1 + dirY * end)
      .stroke({ width, color, alpha });
    travelled += dashLen + gapLen;
  }
}

/**
 * Perpendicular of a map-space unit vector, rotated so that offsetting a
 * point by it and then converting through `toSceneSpace` moves the same
 * way on screen as the interior lane-divider offsets in `drawStatic`
 * (which compute their own perpendicular from already-Y-flipped scene
 * points). Working entirely in map space and converting whole points
 * through `toSceneSpace` — rather than flipping vectors by hand — avoids
 * re-deriving that sign flip at every call site.
 */
function mapPerp(dir: [number, number]): [number, number] {
  return [dir[1], -dir[0]];
}

/** Corners of a rectangle centered at `center`, `length` long along unit vector `dir` and `thickness` wide along unit vector `perp` — same space as `center` (map or scene, caller's choice, as long as `dir`/`perp` match). */
function orientedRectCorners(
  center: [number, number],
  dir: [number, number],
  perp: [number, number],
  length: number,
  thickness: number,
): [number, number][] {
  const hl = length / 2;
  const ht = thickness / 2;
  const [cx, cy] = center;
  const [dx, dy] = dir;
  const [px, py] = perp;
  return [
    [cx + dx * hl + px * ht, cy + dy * hl + py * ht],
    [cx + dx * hl - px * ht, cy + dy * hl - py * ht],
    [cx - dx * hl - px * ht, cy - dy * hl - py * ht],
    [cx - dx * hl + px * ht, cy - dy * hl + py * ht],
  ];
}

/**
 * Strokes only the long sides of a ribbon polygon (as returned by
 * `offsetRibbon`), skipping its two end caps. Stroking the *whole* ribbon
 * outline drew a crisp dark line across the end cap nearest the junction —
 * exactly where that ribbon overlaps the central plaza fill, which has no
 * stroke of its own — reading as a visible seam between each arm and the
 * plaza instead of one continuous paved surface.
 */
function strokeRibbonSides(
  g: Graphics,
  ribbon: [number, number][],
  width: number,
  color: number,
  alpha: number,
) {
  const n = ribbon.length / 2;
  if (n < 2) return;
  for (const side of [ribbon.slice(0, n), ribbon.slice(n)]) {
    g.moveTo(side[0][0], side[0][1]);
    for (let i = 1; i < side.length; i++) {
      g.lineTo(side[i][0], side[i][1]);
    }
    g.stroke({ width, color, alpha });
  }
}

interface VehicleSprite {
  container: Graphics;
  body: Graphics;
  beacon?: Graphics;
  beaconSize: number;
  beaconOn: boolean;
  type: VehicleType;
  fromX: number;
  fromY: number;
  fromRotation: number;
  toX: number;
  toY: number;
  toRotation: number;
  startedAt: number;
  removing: boolean;
}

export function JunctionPixiCanvas({
  geometry,
  trafficState,
}: {
  geometry: NetworkGeometry;
  trafficState: TrafficState | null;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const appRef = React.useRef<Application | null>(null);
  const sceneRef = React.useRef<Graphics | null>(null);
  const congestionLayerRef = React.useRef<Graphics | null>(null);
  const signalLayerRef = React.useRef<Container | null>(null);
  const vehicleLayerRef = React.useRef<Graphics | null>(null);
  const labelLayerRef = React.useRef<Container | null>(null);
  const labelTextsRef = React.useRef<Partial<Record<ApproachDirection, Text>>>(
    {},
  );
  const signalGraphicsRef = React.useRef<Partial<Record<string, Graphics>>>({});
  const vehiclesRef = React.useRef<Map<string, VehicleSprite>>(new Map());
  const geometryRef = React.useRef(geometry);

  geometryRef.current = geometry;

  const drawStatic = React.useCallback(() => {
    const app = appRef.current;
    const scene = sceneRef.current;
    if (!app || !scene) return;
    const geo = geometryRef.current;
    const { bounds } = geo;
    const { roadWidth, armReach, cornerRadius } = pavementGeometryFor(bounds);

    scene.clear();

    // A solid paved area under the crossing point, shaped like the real
    // road corners (rounded concave notches between arms) rather than a
    // plain circle, drawn first so the road ribbons lay cleanly on top of
    // one continuous asphalt surface with no seams.
    // The road ribbons below are drawn `roadWidth * 2` wide (one
    // direction's lane block on each side of the centerline), so the
    // pavement outline's own half-width must be sized off that same full
    // carriageway width — not the one-direction `roadWidth` — or the plaza
    // ends up half as wide as the ribbons it's meant to cover, leaving
    // their corners poking out past it.
    const pavement = junctionPavementOutline(
      geo,
      roadWidth * 2,
      armReach,
      cornerRadius,
    );
    if (pavement.length > 0) {
      const scenePavement = pavement.map((p) => ({
        ...toSceneSpaceRounded(bounds, p),
      }));
      scene.roundShape(scenePavement, 0).fill(ASPHALT);
    }

    const laneWidth = laneWidthFor(bounds);
    const center = junctionCenter(geo);

    // Reading outward from the junction center: the pavement plaza (out to
    // `armReach`), then each lane's signal tick (drawn in `drawSignals`),
    // then a straight-ahead direction arrow on each lane, then the zebra
    // crossing, then the regular dashed lane markings and approaching
    // traffic — the same stop-line layout real SUMO-GUI renders. All of it
    // anchored `armReach` + gaps out from the junction *center*, not the
    // real (much closer-in) SUMO stop line — see `pavementGeometryFor`.
    const tick = signalTickGeometryFor(laneWidth);
    const arrow = laneArrowGeometryFor(laneWidth);
    const tickOuterEdge = armReach + tick.gap + tick.thickness;
    const arrowCenterDistance = tickOuterEdge + arrow.gap + arrow.length / 2;
    const arrowOuterEdge = arrowCenterDistance + arrow.length / 2;
    const crossGap = laneWidth * 0.4;
    const crosswalkDepth = laneWidth * 1.2;
    const crosswalkDistance = arrowOuterEdge + crossGap + crosswalkDepth / 2;
    const crosswalkNearDistance = crosswalkDistance - crosswalkDepth / 2;
    const crosswalkFarDistance = crosswalkDistance + crosswalkDepth / 2;

    for (const direction of DIRECTIONS) {
      // Both directions of travel share one drawn carriageway, built from
      // the inbound lane's own centerline (the two real centerlines are
      // only a couple of units apart — close enough to treat as one road
      // for rendering purposes).
      const inLane = geo.lanes.find(
        (lane) => lane.direction === direction && lane.kind === "in",
      );
      if (!inLane) continue;
      const scenePoints = inLane.shape.map((pt) => toSceneSpace(bounds, pt));
      const ribbon = offsetRibbon(scenePoints, roadWidth * 2);
      if (ribbon.length > 0) {
        scene.poly(ribbon.flat()).fill(ASPHALT);
        // A crisp dark edge line where the asphalt meets the grass, the
        // way SUMO-GUI outlines every lane — only along the ribbon's two
        // long sides, not its end caps. The end cap nearest the junction
        // sits on top of the (unstroked) plaza fill; stroking it too drew
        // a seam right across the plaza instead of one continuous surface.
        strokeRibbonSides(scene, ribbon, roadWidth * 0.02, ASPHALT_EDGE, 0.9);
      }

      // Travel direction (into the junction) and its outward reverse, plus
      // how far the real lane's own outer endpoint sits from the junction
      // center — everything below is parameterized as `center + outward *
      // distance` so the lane arrows/crosswalk/tick geometry all line up
      // exactly, and so the lane dividers can be skipped across the
      // crosswalk's own span instead of running straight through it.
      const outerMap = inLane.shape[0];
      const innerMap = inLane.shape[inLane.shape.length - 1];
      const tx = innerMap[0] - outerMap[0];
      const ty = innerMap[1] - outerMap[1];
      const segLen = Math.hypot(tx, ty) || 1;
      const dirVec: [number, number] = [tx / segLen, ty / segLen];
      const outwardVec: [number, number] = [-dirVec[0], -dirVec[1]];
      const perpVec = mapPerp(dirVec);
      const outerDist = Math.hypot(
        outerMap[0] - center.x,
        outerMap[1] - center.y,
      );

      const pointAt = (distance: number): [number, number] =>
        toSceneSpace(bounds, [
          center.x + outwardVec[0] * distance,
          center.y + outwardVec[1] * distance,
        ]);

      // Lane dividers only across the two stretches of road that aren't
      // the crosswalk — from the plaza edge out to just before the
      // crossing, then from just past it out to where the real lane data
      // ends. Drawing them the full length (as the crosswalk stripes were
      // then painted over) left the dashes and centerline showing through
      // the gaps *between* the zebra stripes.
      const dividerSpans: [number, number][] = [
        [armReach, crosswalkNearDistance],
        [crosswalkFarDistance, outerDist],
      ];
      for (const [nearD, farD] of dividerSpans) {
        if (farD <= nearD) continue;
        const [x1, y1] = pointAt(nearD);
        const [x2, y2] = pointAt(farD);
        const dashLen = roadWidth * 0.25;
        const gapLen = roadWidth * 0.3;
        const dashWidth = roadWidth * 0.035;

        // The centerline itself: a solid divider between the two
        // directions of travel.
        drawOffsetSolidLine(
          scene,
          x1,
          y1,
          x2,
          y2,
          0,
          dashWidth * 1.3,
          ROAD_PAINT,
          0.9,
        );

        // Dashed boundaries between the LANES_PER_DIRECTION lanes within
        // each direction's own half of the carriageway — purely cosmetic
        // (see LANES_PER_DIRECTION), not derived from separate simulated
        // lanes.
        for (let lane = 1; lane < LANES_PER_DIRECTION; lane++) {
          const offset = lane * laneWidth;
          drawOffsetDashedLine(
            scene,
            x1,
            y1,
            x2,
            y2,
            offset,
            dashLen,
            gapLen,
            dashWidth,
            ROAD_PAINT,
            0.85,
          );
          drawOffsetDashedLine(
            scene,
            x1,
            y1,
            x2,
            y2,
            -offset,
            dashLen,
            gapLen,
            dashWidth,
            ROAD_PAINT,
            0.85,
          );
        }
      }

      // One straight-ahead direction arrow per lane, right after that
      // lane's signal tick — this network has no per-lane turn
      // restrictions, so every lane gets the same forward arrow.
      for (let lane = 0; lane < LANES_PER_DIRECTION; lane++) {
        const laneOffset = (lane + 0.5) * laneWidth;
        const arrowCenterMap: [number, number] = [
          center.x +
            outwardVec[0] * arrowCenterDistance +
            perpVec[0] * laneOffset,
          center.y +
            outwardVec[1] * arrowCenterDistance +
            perpVec[1] * laneOffset,
        ];
        const { shaft, head } = laneArrowPolygons(
          arrowCenterMap,
          dirVec,
          perpVec,
          arrow.length,
          arrow.width,
        );
        scene
          .poly(shaft.map(([x, y]) => toSceneSpace(bounds, [x, y])).flat())
          .fill({ color: ROAD_PAINT, alpha: 0.85 });
        scene
          .poly(head.map(([x, y]) => toSceneSpace(bounds, [x, y])).flat())
          .fill({ color: ROAD_PAINT, alpha: 0.85 });
      }
    }

    // Zebra pedestrian crossings, one per approach. A real crosswalk's
    // stripes each run ALONG the direction of travel (the way pedestrians
    // walking across the road cut perpendicular to them) and are repeated
    // side by side ACROSS the road's width — not the other way around.
    const crosswalks = crosswalkAnchors(geo, crosswalkDistance);
    const crosswalkSpan = roadWidth * 2 * 0.94;
    const stripeCount = 9;
    const stripeWidth = crosswalkSpan / (2 * stripeCount - 1);
    for (const direction of DIRECTIONS) {
      const anchor = crosswalks[direction];
      if (!anchor) continue;
      for (let i = 0; i < stripeCount; i++) {
        const delta = (i - (stripeCount - 1) / 2) * stripeWidth * 2;
        const centerMap: [number, number] = [
          anchor.center[0] + anchor.perpendicular[0] * delta,
          anchor.center[1] + anchor.perpendicular[1] * delta,
        ];
        const corners = orientedRectCorners(
          centerMap,
          anchor.direction,
          anchor.perpendicular,
          crosswalkDepth,
          stripeWidth,
        ).map(([x, y]) => toSceneSpace(bounds, [x, y]));
        scene.poly(corners.flat()).fill({ color: ROAD_PAINT, alpha: 0.85 });
      }
    }

    // Direction captions ("North"/"South"/...) set back along each arm and
    // offset into the grass beside the road, so a viewer can read
    // orientation without the text sitting on top of the lane markings.
    // World-space (pan/zoom with the plaza); a matching counter-scale is
    // applied per frame so the glyphs stay a constant, legible screen size.
    const labelLayer = labelLayerRef.current;
    if (labelLayer) {
      const labelDistance = armReach + roadWidth * 0.5;
      const labelLateralOffset = roadWidth + laneWidth;
      const anchors = directionLabelAnchors(
        geo,
        labelDistance,
        labelLateralOffset,
      );
      for (const direction of DIRECTIONS) {
        let text = labelTextsRef.current[direction];
        if (!text) {
          text = new Text({
            text: DIRECTION_LABEL[direction],
            style: {
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 1,
              fill: LABEL_FILL,
              stroke: { color: LABEL_STROKE, width: 3 },
            },
          });
          text.anchor.set(0.5);
          labelLayer.addChild(text);
          labelTextsRef.current[direction] = text;
        }
        const anchor = anchors[direction];
        if (anchor) {
          const [sx, sy] = toSceneSpace(bounds, [anchor.x, anchor.y]);
          text.position.set(sx, sy);
          text.visible = true;
        } else {
          text.visible = false;
        }
      }
    }
  }, []);

  const drawSignals = React.useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    const geo = geometryRef.current;
    const { bounds } = geo;
    const laneWidth = laneWidthFor(bounds);
    const { armReach } = pavementGeometryFor(bounds);
    const center = junctionCenter(geo);
    const positions = signalPositions(geo);
    // One short tick per simulated lane, laid crosswise over just that
    // lane — not a single bar spanning the whole direction's lane block,
    // and not running lengthwise with the lane either: a real stop-line
    // signal mark reads as a small gate across the lane it controls, the
    // same way the lane divider and crosswalk stripes it sits between are
    // both lengthwise with the road, and the light has to contrast with
    // both. Positioned `armReach` + a small gap out from the junction
    // *center* — the edge of the cosmetic pavement plaza, not the real
    // (much closer-in) SUMO stop line `pos.stop` — so the ticks sit just
    // past the plaza instead of buried inside it. Kept in sync with the
    // lane-arrow and crosswalk geometry in `drawStatic`, which both start
    // right where these ticks end.
    const tick = signalTickGeometryFor(laneWidth);
    const tickCenterDistance = armReach + tick.gap + tick.thickness / 2;

    for (const direction of DIRECTIONS) {
      const pos = positions[direction];
      if (!pos) continue;
      let group = signalGraphicsRef.current[direction];
      if (!group) {
        group = new Graphics();
        signalLayerRef.current?.addChild(group);
        signalGraphicsRef.current[direction] = group;
      }

      // `pos.direction` points into the junction; outward is its reverse,
      // and it's what actually places the tick block (the true `pos.stop`
      // is only used for orientation via `pos.direction` here).
      const outward: [number, number] = [-pos.direction[0], -pos.direction[1]];
      const perp = mapPerp(pos.direction);
      const state = signalStateFor(direction, trafficState?.activePhase);
      group.clear();

      for (let lane = 0; lane < LANES_PER_DIRECTION; lane++) {
        const laneOffset = (lane + 0.5) * laneWidth;
        const centerMap: [number, number] = [
          center.x + outward[0] * tickCenterDistance + perp[0] * laneOffset,
          center.y + outward[1] * tickCenterDistance + perp[1] * laneOffset,
        ];
        // `span` (across the lane) runs along `perp`, `thickness` (along
        // the lane) runs along `pos.direction` — the reverse pairing of
        // the lane arrows and crosswalk stripes just past this tick.
        const corners = orientedRectCorners(
          centerMap,
          perp,
          pos.direction,
          tick.span,
          tick.thickness,
        ).map(([x, y]) => toSceneSpace(bounds, [x, y]));
        group.poly(corners.flat()).fill(SIGNAL_COLOR[state]);
      }
    }
  }, [trafficState?.activePhase]);

  const drawCongestion = React.useCallback(() => {
    const layer = congestionLayerRef.current;
    if (!layer) return;
    const geo = geometryRef.current;
    const { bounds } = geo;
    const roadWidth = roadWidthFor(bounds);

    layer.clear();
    if (!trafficState) return;

    for (const lane of geo.lanes) {
      if (lane.kind !== "in") continue;
      const approach = trafficState.approaches[lane.direction];
      if (!approach) continue;
      const level = congestionLevel(approach);
      if (level <= 0.02) continue;
      const scenePoints = lane.shape.map((pt) => toSceneSpace(bounds, pt));
      const ribbon = offsetRibbon(scenePoints, roadWidth * 0.85);
      if (ribbon.length === 0) continue;
      // Low alpha so the dashed lane markings underneath stay legible —
      // this is a wash over the asphalt, not an opaque overlay.
      layer.poly(ribbon.flat()).fill({
        color: congestionColor(level),
        alpha: 0.14 + level * 0.22,
      });
    }
  }, [trafficState]);

  const syncVehicles = React.useCallback(() => {
    const scene = sceneRef.current;
    const layer = vehicleLayerRef.current;
    if (!scene || !layer) return;
    const geo = geometryRef.current;
    const extent = Math.max(
      geo.bounds.maxX - geo.bounds.minX,
      geo.bounds.maxY - geo.bounds.minY,
    );
    const vehicles = trafficState?.vehicles ?? [];
    const seen = new Set<string>();
    const now = performance.now();

    for (const vehicle of vehicles) {
      seen.add(vehicle.vehicleId);
      const [sx, sy] = toSceneSpace(geo.bounds, [vehicle.x, vehicle.y]);
      let sprite = vehiclesRef.current.get(vehicle.vehicleId);
      const size = extent * 0.017 * VEHICLE_SIZE_SCALE[vehicle.vehicleType];

      if (!sprite) {
        const isEmergency = vehicle.vehicleType === "emergency";
        const shape = VEHICLE_SHAPE[vehicle.vehicleType](size).flat();

        const body = new Graphics();
        body
          .poly(shape)
          .fill(isEmergency ? EMERGENCY_FILL : VEHICLE_FILL)
          .stroke({
            width: size * 0.1,
            color: VEHICLE_OUTLINE,
            alpha: 0.7,
          });

        const container = new Graphics();
        container.addChild(body);
        let beacon: Graphics | undefined;
        if (isEmergency) {
          beacon = new Graphics();
          beacon.circle(0, -size * 0.15, size * 0.28).fill(EMERGENCY_BEACON[0]);
          container.addChild(beacon);
        }
        container.x = sx;
        container.y = sy;
        container.rotation = (vehicle.angleDeg * Math.PI) / 180;
        container.alpha = 0;
        container.scale.set(0.4);
        layer.addChild(container);

        sprite = {
          container,
          body,
          beacon,
          beaconSize: size,
          beaconOn: true,
          type: vehicle.vehicleType,
          fromX: sx,
          fromY: sy,
          fromRotation: vehicle.angleDeg,
          toX: sx,
          toY: sy,
          toRotation: vehicle.angleDeg,
          startedAt: now,
          removing: false,
        };
        vehiclesRef.current.set(vehicle.vehicleId, sprite);
        continue;
      }

      sprite.removing = false;
      const currentT = Math.min((now - sprite.startedAt) / TWEEN_MS, 1);
      const eased = easeInOutCubic(currentT);
      sprite.fromX = sprite.fromX + (sprite.toX - sprite.fromX) * eased;
      sprite.fromY = sprite.fromY + (sprite.toY - sprite.fromY) * eased;
      sprite.fromRotation =
        sprite.fromRotation +
        shortestAngleDelta(sprite.fromRotation, sprite.toRotation) * eased;
      sprite.toX = sx;
      sprite.toY = sy;
      sprite.toRotation = vehicle.angleDeg;
      sprite.startedAt = now;
    }

    for (const [id, sprite] of vehiclesRef.current) {
      if (!seen.has(id) && !sprite.removing) {
        sprite.removing = true;
        sprite.startedAt = now;
      }
    }
  }, [trafficState]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounts the Pixi Application exactly once; drawStatic/drawSignals/drawCongestion are invoked by the effects below on subsequent updates via refs, not re-run here.
  React.useEffect(() => {
    let cancelled = false;
    const app = new Application();
    const host = hostRef.current;
    if (!host) return;

    app
      .init({
        resizeTo: host,
        antialias: true,
        backgroundAlpha: 1,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (cancelled || !hostRef.current) {
          app.destroy(true, { children: true });
          return;
        }
        hostRef.current.appendChild(app.canvas);
        appRef.current = app;

        // World layer: everything that pans/zooms together with the fit
        // transform, stacked bottom to top — roads/pavement, the live
        // congestion tint over them, signal bars on top of the tint (so it
        // never muddies their color), vehicles above the road surface, and
        // direction captions on top of all of it.
        const scene = new Graphics();
        const congestionLayer = new Graphics();
        const signalLayer = new Container();
        const vehicleLayer = new Graphics();
        const labelLayer = new Container();
        const world = new Container();
        world.addChild(
          scene,
          congestionLayer,
          signalLayer,
          vehicleLayer,
          labelLayer,
        );
        app.stage.addChild(world);

        sceneRef.current = scene;
        congestionLayerRef.current = congestionLayer;
        signalLayerRef.current = signalLayer;
        vehicleLayerRef.current = vehicleLayer;
        labelLayerRef.current = labelLayer;

        app.renderer.background.color = GRASS;
        drawStatic();
        drawSignals();
        drawCongestion();

        app.ticker.add(() => {
          const geo = geometryRef.current;
          const { bounds } = geo;
          const sceneW = bounds.maxX - bounds.minX || 1;
          const sceneH = bounds.maxY - bounds.minY || 1;
          const { scale, offsetX, offsetY } = fitTransform(
            app.screen.width,
            app.screen.height,
            sceneW,
            sceneH,
          );
          world.scale.set(scale);
          world.position.set(offsetX, offsetY);

          // Direction captions live in world space (so they pan with the
          // plaza) but counter-scale against the world zoom so they stay a
          // constant, legible screen size.
          const inverseScale = scale > 0 ? 1 / scale : 1;
          for (const text of Object.values(labelTextsRef.current)) {
            text?.scale.set(inverseScale);
          }

          const now = performance.now();
          for (const [id, sprite] of vehiclesRef.current) {
            const t = Math.min((now - sprite.startedAt) / TWEEN_MS, 1);
            const eased = easeInOutCubic(t);

            if (sprite.removing) {
              sprite.container.alpha = 1 - eased;
              sprite.container.scale.set(1 - eased * 0.6);
              if (t >= 1) {
                sprite.container.destroy({ children: true });
                vehiclesRef.current.delete(id);
              }
              continue;
            }

            sprite.container.alpha = Math.min(sprite.container.alpha + 0.08, 1);
            const scaleNow = Math.min(sprite.container.scale.x + 0.08, 1);
            sprite.container.scale.set(scaleNow);
            sprite.container.x =
              sprite.fromX + (sprite.toX - sprite.fromX) * eased;
            sprite.container.y =
              sprite.fromY + (sprite.toY - sprite.fromY) * eased;
            const rotation =
              sprite.fromRotation +
              shortestAngleDelta(sprite.fromRotation, sprite.toRotation) *
                eased;
            sprite.container.rotation = (rotation * Math.PI) / 180;

            if (sprite.type === "emergency" && sprite.beacon) {
              const phase =
                (now % EMERGENCY_BEACON_PERIOD_MS) / EMERGENCY_BEACON_PERIOD_MS;
              const on = phase < 0.5;
              if (on !== sprite.beaconOn) {
                sprite.beaconOn = on;
                sprite.beacon.clear();
                sprite.beacon
                  .circle(
                    0,
                    -sprite.beaconSize * 0.15,
                    sprite.beaconSize * 0.28,
                  )
                  .fill(on ? EMERGENCY_BEACON[0] : EMERGENCY_BEACON[1]);
              }
            }
          }
        });
      })
      .catch(() => {
        // No WebGL/Canvas2D context available (e.g. headless test
        // environments) — the wrapping component still renders its
        // accessible summary, so this is a silent no-op rather than a
        // crash.
        try {
          app.destroy(true, { children: true });
        } catch {
          // already torn down or never fully initialized
        }
      });

    return () => {
      cancelled = true;
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      sceneRef.current = null;
      congestionLayerRef.current = null;
      signalLayerRef.current = null;
      vehicleLayerRef.current = null;
      labelLayerRef.current = null;
      labelTextsRef.current = {};
      signalGraphicsRef.current = {};
      vehiclesRef.current.clear();
    };
  }, []);

  React.useEffect(() => {
    if (!appRef.current) return;
    drawStatic();
  }, [drawStatic]);

  React.useEffect(() => {
    if (!appRef.current) return;
    drawSignals();
  }, [drawSignals]);

  React.useEffect(() => {
    if (!appRef.current) return;
    drawCongestion();
  }, [drawCongestion]);

  React.useEffect(() => {
    if (!appRef.current) return;
    syncVehicles();
  }, [syncVehicles]);

  const phaseProgressPct = trafficState
    ? Math.min(
        (trafficState.elapsedPhaseTimeSec / PHASE_PROGRESS_REFERENCE_SEC) * 100,
        100,
      )
    : 0;

  return (
    <div className="relative aspect-square w-full max-w-3xl overflow-hidden rounded-lg border border-border">
      <div ref={hostRef} aria-hidden className="absolute inset-0" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2 p-2.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-mono tabular-nums">
              Tick {trafficState?.tick ?? "—"}
            </Badge>
            <Badge variant="outline" className="font-mono tabular-nums">
              {trafficState?.activePhase ?? "IDLE"} ·{" "}
              {trafficState
                ? `${Math.round(trafficState.elapsedPhaseTimeSec)}s`
                : "—"}
            </Badge>
          </div>
        </div>

        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-primary/70 transition-[width]"
            style={{ width: `${phaseProgressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
