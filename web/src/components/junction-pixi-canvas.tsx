"use client";

import { Application, Container, Graphics, Text } from "pixi.js";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  congestionColor,
  congestionLevel,
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
const LANE_WIDTH_RATIO = 0.045;
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
    const roadWidth = roadWidthFor(bounds);

    scene.clear();

    // A solid paved area under the crossing point, shaped like the real
    // road corners (rounded concave notches between arms) rather than a
    // plain circle, drawn first so the road ribbons lay cleanly on top of
    // one continuous asphalt surface with no seams.
    const armReach = roadWidth * 1.5;
    const cornerRadius = roadWidth * 0.4;
    const pavement = junctionPavementOutline(
      geo,
      roadWidth,
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
        // way SUMO-GUI outlines every lane.
        scene.poly(ribbon.flat()).stroke({
          width: roadWidth * 0.02,
          color: ASPHALT_EDGE,
          alpha: 0.9,
        });
      }

      for (let i = 0; i < scenePoints.length - 1; i++) {
        const [x1, y1] = scenePoints[i];
        const [x2, y2] = scenePoints[i + 1];
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
    const roadWidth = roadWidthFor(bounds);
    const positions = signalPositions(geo);
    // Spans one direction's own lane block, not the full two-direction
    // carriageway — otherwise it reads as blocking traffic that isn't
    // actually facing this light.
    const barLength = roadWidth * 0.85;
    const barThickness = roadWidth * 0.18;
    // Pulled back from the stop line, away from the junction center — the
    // four approaches' stop lines sit close enough together that an
    // unshifted bar for one approach can visually crowd its neighbors'.
    const setback = roadWidth * 0.7;

    for (const direction of DIRECTIONS) {
      const pos = positions[direction];
      if (!pos) continue;
      let bar = signalGraphicsRef.current[direction];
      if (!bar) {
        bar = new Graphics();
        signalLayerRef.current?.addChild(bar);
        signalGraphicsRef.current[direction] = bar;
      }

      const stop = toSceneSpace(bounds, pos.stop);
      // toSceneSpace flips Y, so the direction vector's Y component flips
      // sign going from map space to scene space — recompute the on-screen
      // heading rather than reusing the map-space vector directly.
      const [dx, dyMap] = pos.direction;
      const dy = -dyMap;
      const heading = Math.atan2(dy, dx);

      // Move backward along the approach (away from the junction, the
      // opposite of `direction`, which points into it) by `setback`.
      bar.position.set(stop[0] - dx * setback, stop[1] - dy * setback);
      // The bar is drawn along its local X axis and rotated 90° from the
      // lane's own heading so it lies across the lane, at the stop line —
      // exactly how SUMO-GUI marks a controlled connection.
      bar.rotation = heading + Math.PI / 2;

      const state = signalStateFor(direction, trafficState?.activePhase);
      bar.clear();
      bar
        .rect(-barLength / 2, -barThickness / 2, barLength, barThickness)
        .fill(SIGNAL_COLOR[state]);
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
