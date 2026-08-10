"use client";

import { useTheme } from "next-themes";
import { Application, Container, Graphics, Text } from "pixi.js";
import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  congestionColor,
  congestionLevel,
  contextBlocks,
  crosswalkAnchors,
  DIRECTION_LABEL,
  DIRECTIONS,
  directionLabelAnchors,
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

const SIGNAL_COLOR: Record<"red" | "yellow" | "green", number> = {
  red: 0xef4444,
  yellow: 0xeab308,
  green: 0x22c55e,
};
const SIGNAL_LAMP_ORDER: ("red" | "yellow" | "green")[] = [
  "red",
  "yellow",
  "green",
];

const EMERGENCY_FILL = 0xef4444;
const EMERGENCY_BEACON = [0xef4444, 0x3b82f6];

const TWEEN_MS = 900;
const EMERGENCY_BEACON_PERIOD_MS = 600;

// Typical single-approach green window used only to give the phase-elapsed
// indicator something to fill toward — a visual reference, not a scheduler
// bound (the scheduler's actual min/max green thresholds aren't part of
// TrafficState and shouldn't be guessed at here).
const PHASE_PROGRESS_REFERENCE_SEC = 30;

// Uniform shrink applied on top of the fit-to-canvas scale so the pavement
// never runs flush to the frame edge — leaves breathing room around the
// plaza for the surrounding context (buildings/greenery) and vignette.
const FRAME_MARGIN = 0.86;

// Real-world material colors (asphalt, road paint, signal housing) read
// consistently regardless of the app's light/dark theme — unlike UI
// surface colors, these don't need to invert, only the canvas background
// and vehicle/plaza tinting adapt to theme.
const ASPHALT = 0x48494b;
const ASPHALT_SHOULDER = 0x3a3b3d;
const ROAD_PAINT = 0xf4f4f2;
const SIGNAL_HOUSING = 0x232326;
const SIGNAL_POLE = 0x1a1a1c;
const SIGNAL_BACKBOARD = 0x101012;
const SIGNAL_BACKBOARD_BORDER = 0xd9b64f;

interface ThemeColors {
  background: number;
  plaza: number;
  vehicle: number;
  vehicleAlpha: number;
  vehicleOutline: number;
  housingOutline: number;
  foreground: number;
  contextBuilding: number;
  contextGreen: number;
}

// getComputedStyle resolves this app's oklch() theme tokens to whatever
// color-space syntax the browser prefers for output (observed: lab()),
// not always legacy rgb() — so the reliable way to get an 0xRRGGBB sRGB
// value is to let a 2D canvas do the color-space conversion via readback,
// rather than parsing the computed string ourselves.
function resolveCssColor(varName: string): number {
  const probe = document.createElement("div");
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  const colorString = getComputedStyle(probe).color;
  document.body.removeChild(probe);

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0x888888;
  ctx.fillStyle = colorString;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

function resolveThemeColors(): ThemeColors {
  return {
    background: resolveCssColor("--color-muted"),
    plaza: resolveCssColor("--color-muted-foreground"),
    vehicle: resolveCssColor("--color-foreground"),
    vehicleAlpha: 0.85,
    vehicleOutline: resolveCssColor("--color-border"),
    housingOutline: resolveCssColor("--color-border"),
    foreground: resolveCssColor("--color-foreground"),
    contextBuilding: resolveCssColor("--color-muted-foreground"),
    contextGreen: resolveCssColor("--color-chart-2"),
  };
}

const ROAD_WIDTH_RATIO = 0.12;

function roadWidthFor(bounds: NetworkGeometry["bounds"]): number {
  return (
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) *
    ROAD_WIDTH_RATIO
  );
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
  const contextLayerRef = React.useRef<Graphics | null>(null);
  const sceneRef = React.useRef<Graphics | null>(null);
  const congestionLayerRef = React.useRef<Graphics | null>(null);
  const vehicleLayerRef = React.useRef<Graphics | null>(null);
  const labelLayerRef = React.useRef<Container | null>(null);
  const labelTextsRef = React.useRef<Partial<Record<ApproachDirection, Text>>>(
    {},
  );
  const vignetteRef = React.useRef<Graphics | null>(null);
  const compassRef = React.useRef<Graphics | null>(null);
  const compassLabelRef = React.useRef<Text | null>(null);
  const hudSizeRef = React.useRef({ w: 0, h: 0 });
  const signalGraphicsRef = React.useRef<Partial<Record<string, Graphics>>>({});
  const vehiclesRef = React.useRef<Map<string, VehicleSprite>>(new Map());
  const geometryRef = React.useRef(geometry);
  const colorsRef = React.useRef<ThemeColors | null>(null);
  const { resolvedTheme } = useTheme();

  geometryRef.current = geometry;

  const drawContext = React.useCallback((colors: ThemeColors) => {
    const layer = contextLayerRef.current;
    if (!layer) return;
    const geo = geometryRef.current;
    const { bounds } = geo;
    const roadWidth = roadWidthFor(bounds);
    const blocks = contextBlocks(geo, roadWidth);

    layer.clear();
    for (const block of blocks) {
      const [x1, y1] = toSceneSpace(bounds, [block.x, block.y]);
      const [x2, y2] = toSceneSpace(bounds, [
        block.x + block.w,
        block.y + block.h,
      ]);
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      if (block.kind === "green") {
        layer
          .roundRect(left, top, w, h, Math.min(w, h) * 0.25)
          .fill({ color: colors.contextGreen, alpha: 0.1 });
      } else {
        layer.rect(left, top, w, h).fill({
          color: colors.contextBuilding,
          alpha: 0.08,
        });
      }
    }
  }, []);

  const drawStatic = React.useCallback((colors: ThemeColors) => {
    const app = appRef.current;
    const scene = sceneRef.current;
    if (!app || !scene) return;
    const geo = geometryRef.current;
    const { bounds } = geo;
    const roadWidth = roadWidthFor(bounds);

    scene.clear();

    // A solid paved area under the crossing point, shaped like the real
    // road corners (rounded concave notches between arms) rather than a
    // plain circle, drawn first so the road ribbons and crosswalks lay
    // cleanly on top of one continuous asphalt surface with no seams.
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
      scene.roundShape(scenePavement, 0).stroke({
        width: roadWidth * 0.02,
        color: ASPHALT_SHOULDER,
        alpha: 0.6,
      });
      const cx =
        scenePavement.reduce((sum, p) => sum + p.x, 0) / scenePavement.length;
      const cy =
        scenePavement.reduce((sum, p) => sum + p.y, 0) / scenePavement.length;
      // Soft theme-tinted glow behind the plaza for depth, subtle enough
      // not to read as its own shape.
      scene
        .circle(cx, cy, armReach * 1.4)
        .fill({ color: colors.plaza, alpha: 0.08 });
    }

    for (const lane of geo.lanes) {
      const scenePoints = lane.shape.map((pt) => toSceneSpace(bounds, pt));
      const ribbon = offsetRibbon(scenePoints, roadWidth);
      if (ribbon.length > 0) {
        scene.poly(ribbon.flat()).fill(ASPHALT);
        scene.poly(ribbon.flat()).stroke({
          width: roadWidth * 0.03,
          color: ASPHALT_SHOULDER,
          alpha: 0.7,
        });
      }
      for (let i = 0; i < scenePoints.length - 1; i++) {
        const [x1, y1] = scenePoints[i];
        const [x2, y2] = scenePoints[i + 1];
        const segLen = Math.hypot(x2 - x1, y2 - y1);
        const dashLen = roadWidth * 0.4;
        const gapLen = roadWidth * 0.5;
        const dirX = (x2 - x1) / (segLen || 1);
        const dirY = (y2 - y1) / (segLen || 1);
        let travelled = 0;
        while (travelled < segLen) {
          const start = travelled;
          const end = Math.min(travelled + dashLen, segLen);
          scene
            .moveTo(x1 + dirX * start, y1 + dirY * start)
            .lineTo(x1 + dirX * end, y1 + dirY * end)
            .stroke({
              width: roadWidth * 0.06,
              color: ROAD_PAINT,
              alpha: 0.85,
            });
          travelled += dashLen + gapLen;
        }
      }
    }

    const crosswalks = crosswalkAnchors(geo, roadWidth);
    const stripeCount = 6;
    const stripeLen = roadWidth * 0.22;
    const stripeThickness = roadWidth * 0.11;
    for (const direction of DIRECTIONS) {
      const anchor = crosswalks[direction];
      if (!anchor) continue;
      const anchorCenter = toSceneSpace(bounds, anchor.center);
      const dir: [number, number] = [anchor.direction[0], -anchor.direction[1]];
      const perp: [number, number] = [
        anchor.perpendicular[0],
        -anchor.perpendicular[1],
      ];
      const spacing = roadWidth / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        const offset = (i - (stripeCount - 1) / 2) * spacing;
        const cx = anchorCenter[0] + perp[0] * offset;
        const cy = anchorCenter[1] + perp[1] * offset;
        const halfLen = stripeLen / 2;
        const halfThick = stripeThickness / 2;
        const corners: [number, number][] = [
          [
            cx + dir[0] * halfLen + perp[0] * halfThick,
            cy + dir[1] * halfLen + perp[1] * halfThick,
          ],
          [
            cx + dir[0] * halfLen - perp[0] * halfThick,
            cy + dir[1] * halfLen - perp[1] * halfThick,
          ],
          [
            cx - dir[0] * halfLen - perp[0] * halfThick,
            cy - dir[1] * halfLen - perp[1] * halfThick,
          ],
          [
            cx - dir[0] * halfLen + perp[0] * halfThick,
            cy - dir[1] * halfLen + perp[1] * halfThick,
          ],
        ];
        scene.poly(corners.flat()).fill({ color: ROAD_PAINT, alpha: 0.8 });
      }
    }

    const positions = signalPositions(geo, roadWidth);
    const lightRadius =
      Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.02;
    for (const direction of DIRECTIONS) {
      const pos = positions[direction];
      if (!pos) continue;
      const stop = toSceneSpace(bounds, pos.stop);
      // A small stop-line marker only — no line drawn out to the signal
      // housing itself. The housing sits off to the side of its own arm
      // (see signalPositions' lateral offset, tuned to clear the crossing
      // road's ribbon), which for some arms is nearly as far as the
      // adjacent arm's own stop line; a straight connector between the two
      // then reads as a diagonal slash straight across the junction rather
      // than a mast arm. The housing's own pole + footing (drawn in
      // drawSignals) already grounds it as a mounted structure, so no
      // separate connector is needed here.
      scene
        .circle(stop[0], stop[1], lightRadius * 0.28)
        .fill({ color: SIGNAL_HOUSING, alpha: 0.55 });
    }

    // Direction captions ("North"/"South"/...) set back along each arm so
    // a viewer can read orientation straight off the canvas. World-space
    // (pan/zoom with the plaza); a matching counter-scale is applied per
    // frame so the glyphs stay a constant, legible screen size.
    const labelLayer = labelLayerRef.current;
    if (labelLayer) {
      const labelDistance = armReach + roadWidth * 1.1;
      const anchors = directionLabelAnchors(geo, labelDistance);
      for (const direction of DIRECTIONS) {
        let text = labelTextsRef.current[direction];
        if (!text) {
          text = new Text({
            text: DIRECTION_LABEL[direction],
            style: {
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              fontWeight: "600",
              letterSpacing: 1,
            },
          });
          text.anchor.set(0.5);
          labelLayer.addChild(text);
          labelTextsRef.current[direction] = text;
        }
        text.style.fill = colors.foreground;
        text.alpha = 0.7;
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

  const drawSignals = React.useCallback(
    (theme: ThemeColors) => {
      const app = appRef.current;
      if (!app) return;
      const geo = geometryRef.current;
      const { bounds } = geo;
      const extent = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxY - bounds.minY,
      );
      const roadWidth = roadWidthFor(bounds);
      const lightRadius = extent * 0.02;
      const positions = signalPositions(geo, roadWidth);

      const housingW = lightRadius * 1.9;
      const housingH = lightRadius * 5.6;
      const lampGap = housingH / 3;
      const backboardW = housingW * 1.3;
      const backboardH = housingH * 1.06;
      const poleW = lightRadius * 0.55;
      const poleLen = housingH * 0.85;

      for (const direction of DIRECTIONS) {
        const pos = positions[direction];
        if (!pos) continue;
        let head = signalGraphicsRef.current[direction];
        if (!head) {
          head = new Graphics();
          sceneRef.current?.addChild(head);
          signalGraphicsRef.current[direction] = head;
        }
        const light = toSceneSpace(bounds, pos.light);
        // Real signal heads always hang with a vertical lamp stack
        // (red/yellow/green top to bottom) regardless of which way the
        // road they control runs — rotating the housing to match the
        // road's own orientation looked plausible on paper but reads as
        // wrong for anyone who's seen a real traffic light. Always
        // upright.
        head.position.set(light[0], light[1]);
        head.rotation = 0;

        const state = signalStateFor(direction, trafficState?.activePhase);

        head.clear();

        // Backboard: a slightly oversized dark panel behind the lamp
        // housing with a retro-reflective-style border, the way real
        // signal heads are mounted, so the housing doesn't read as a
        // floating pill.
        head
          .roundRect(
            -backboardW / 2,
            -backboardH / 2,
            backboardW,
            backboardH,
            lightRadius * 0.3,
          )
          .fill({ color: SIGNAL_BACKBOARD, alpha: 0.92 })
          .stroke({
            width: lightRadius * 0.1,
            color: SIGNAL_BACKBOARD_BORDER,
            alpha: 0.5,
          });

        head
          .roundRect(
            -housingW / 2,
            -housingH / 2,
            housingW,
            housingH,
            lightRadius * 0.45,
          )
          .fill(SIGNAL_HOUSING)
          .stroke({
            width: lightRadius * 0.12,
            color: theme.housingOutline,
            alpha: 0.6,
          });

        SIGNAL_LAMP_ORDER.forEach((lampState, i) => {
          const lampY = -housingH / 2 + lampGap * (i + 0.5);
          const isOn = lampState === state;
          head.circle(0, lampY, lightRadius * 0.6).fill({
            color: isOn ? SIGNAL_COLOR[lampState] : 0x000000,
            alpha: isOn ? 1 : 0.4,
          });
        });

        // Supporting pole running down from the housing to a footing, so
        // the signal reads as a mounted structure rather than a floating
        // sign — stays upright with the housing (same invariant above).
        head
          .rect(-poleW / 2, housingH / 2, poleW, poleLen)
          .fill(SIGNAL_POLE)
          .stroke({
            width: lightRadius * 0.08,
            color: theme.housingOutline,
            alpha: 0.4,
          });
        head
          .roundRect(
            (-poleW * 1.3) / 2,
            housingH / 2 + poleLen - lightRadius * 0.3,
            poleW * 1.3,
            lightRadius * 0.5,
            lightRadius * 0.15,
          )
          .fill(SIGNAL_POLE);
      }
    },
    [trafficState?.activePhase],
  );

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
      const ribbon = offsetRibbon(scenePoints, roadWidth * 0.92);
      if (ribbon.length === 0) continue;
      // Low alpha so the dashed lane markings underneath stay legible —
      // this is a wash over the asphalt, not an opaque overlay.
      layer.poly(ribbon.flat()).fill({
        color: congestionColor(level),
        alpha: 0.14 + level * 0.22,
      });
    }
  }, [trafficState]);

  const drawHud = React.useCallback((colors: ThemeColors) => {
    const app = appRef.current;
    const vignette = vignetteRef.current;
    const compass = compassRef.current;
    const compassLabel = compassLabelRef.current;
    if (!app || !vignette || !compass) return;
    const w = app.screen.width;
    const h = app.screen.height;

    // Soft vignette: a few nested, low-alpha frame strokes that darken
    // toward the canvas edges without ever reading as a hard shape.
    vignette.clear();
    const steps = 5;
    const maxInset = Math.min(w, h) * 0.1;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const inset = maxInset * t;
      vignette
        .rect(
          inset,
          inset,
          Math.max(w - inset * 2, 0),
          Math.max(h - inset * 2, 0),
        )
        .stroke({
          width: maxInset / steps + 1,
          color: colors.background,
          alpha: 0.04 + t * 0.1,
        });
    }

    // Compass rose: fixed to the top-right corner in screen space (not
    // scaled/panned with the plaza) — a simple upright N arrow, since
    // toSceneSpace maps increasing map-Y (north) to decreasing scene-Y
    // (up), so "up" on the canvas is always north.
    const margin = 16;
    const radius = 16;
    const cx = w - margin - radius;
    const cy = margin + radius;
    compass.clear();
    compass
      .circle(cx, cy, radius)
      .fill({ color: colors.background, alpha: 0.7 })
      .stroke({ width: 1.5, color: colors.foreground, alpha: 0.35 });
    const armTop = cy - radius * 0.62;
    const armBottom = cy + radius * 0.3;
    compass
      .moveTo(cx, armBottom)
      .lineTo(cx, armTop)
      .stroke({ width: 2, color: colors.foreground, alpha: 0.85 });
    compass
      .poly([cx, armTop - 5, cx - 4.5, armTop + 4, cx + 4.5, armTop + 4])
      .fill({ color: colors.foreground, alpha: 0.9 });

    if (compassLabel) {
      compassLabel.style.fill = colors.foreground;
      compassLabel.position.set(cx, cy + radius * 0.6);
    }

    hudSizeRef.current = { w, h };
  }, []);

  const syncVehicles = React.useCallback(
    (theme: ThemeColors) => {
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

          const shadow = new Graphics();
          shadow
            .ellipse(0, size * 0.1, size * 0.85, size * 0.42)
            .fill({ color: 0x000000, alpha: 0.26 });

          const body = new Graphics();
          body
            .poly(shape)
            .fill({
              color: isEmergency ? EMERGENCY_FILL : theme.vehicle,
              alpha: isEmergency ? 1 : theme.vehicleAlpha,
            })
            .stroke({
              width: size * 0.08,
              color: theme.vehicleOutline,
              alpha: 0.6,
            });

          const container = new Graphics();
          container.addChild(shadow);
          container.addChild(body);
          let beacon: Graphics | undefined;
          if (isEmergency) {
            beacon = new Graphics();
            beacon
              .circle(0, -size * 0.15, size * 0.28)
              .fill(EMERGENCY_BEACON[0]);
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
    },
    [trafficState],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounts the Pixi Application exactly once; drawStatic/drawSignals/drawContext/drawCongestion/drawHud are invoked by the effects below on subsequent updates via refs, not re-run here.
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
        // transform (context silhouettes below the roads, roads/plaza,
        // live congestion tint, vehicles, direction captions on top).
        const contextLayer = new Graphics();
        const scene = new Graphics();
        const congestionLayer = new Graphics();
        const vehicleLayer = new Graphics();
        const labelLayer = new Container();
        const world = new Container();
        world.addChild(
          contextLayer,
          scene,
          congestionLayer,
          vehicleLayer,
          labelLayer,
        );
        app.stage.addChild(world);

        // HUD layer: fixed in screen space regardless of zoom — vignette
        // frame and compass rose.
        const hud = new Container();
        const vignette = new Graphics();
        const compass = new Graphics();
        const compassLabel = new Text({
          text: "N",
          style: {
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
            fontWeight: "700",
          },
        });
        compassLabel.anchor.set(0.5);
        hud.addChild(vignette, compass, compassLabel);
        app.stage.addChild(hud);

        contextLayerRef.current = contextLayer;
        sceneRef.current = scene;
        congestionLayerRef.current = congestionLayer;
        vehicleLayerRef.current = vehicleLayer;
        labelLayerRef.current = labelLayer;
        vignetteRef.current = vignette;
        compassRef.current = compass;
        compassLabelRef.current = compassLabel;

        const colors = resolveThemeColors();
        colorsRef.current = colors;
        app.renderer.background.color = colors.background;
        drawContext(colors);
        drawStatic(colors);
        drawSignals(colors);
        drawCongestion();
        drawHud(colors);

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

          if (
            hudSizeRef.current.w !== app.screen.width ||
            hudSizeRef.current.h !== app.screen.height
          ) {
            if (colorsRef.current) drawHud(colorsRef.current);
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
      contextLayerRef.current = null;
      sceneRef.current = null;
      congestionLayerRef.current = null;
      vehicleLayerRef.current = null;
      labelLayerRef.current = null;
      labelTextsRef.current = {};
      vignetteRef.current = null;
      compassRef.current = null;
      compassLabelRef.current = null;
      hudSizeRef.current = { w: 0, h: 0 };
      signalGraphicsRef.current = {};
      vehiclesRef.current.clear();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolvedTheme is a trigger-only dependency — colors are re-resolved from CSS custom properties, not from this value directly.
  React.useEffect(() => {
    if (!appRef.current) return;
    const colors = resolveThemeColors();
    colorsRef.current = colors;
    appRef.current.renderer.background.color = colors.background;
    drawContext(colors);
    drawStatic(colors);
    drawSignals(colors);
    drawHud(colors);
  }, [resolvedTheme, drawContext, drawStatic, drawSignals, drawHud]);

  React.useEffect(() => {
    if (!appRef.current || !colorsRef.current) return;
    drawSignals(colorsRef.current);
  }, [drawSignals]);

  React.useEffect(() => {
    if (!appRef.current) return;
    drawCongestion();
  }, [drawCongestion]);

  React.useEffect(() => {
    if (!appRef.current || !colorsRef.current) return;
    syncVehicles(colorsRef.current);
  }, [syncVehicles]);

  const emergencyDirections = React.useMemo(() => {
    if (!trafficState) return [] as ApproachDirection[];
    return DIRECTIONS.filter(
      (direction) => trafficState.approaches[direction]?.hasEmergencyVehicle,
    );
  }, [trafficState]);

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

        {emergencyDirections.length > 0 && (
          <Alert
            variant="destructive"
            className="mx-auto w-fit animate-pulse border-destructive/60 bg-destructive/15 shadow-lg backdrop-blur-sm"
          >
            <AlertTitle className="flex items-center gap-1.5 text-sm font-bold tracking-wide">
              <span className="inline-block size-2 rounded-full bg-destructive" />
              EMERGENCY VEHICLE
            </AlertTitle>
            <AlertDescription>
              Priority approach:{" "}
              {emergencyDirections
                .map((direction) => DIRECTION_LABEL[direction])
                .join(", ")}
            </AlertDescription>
          </Alert>
        )}

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
