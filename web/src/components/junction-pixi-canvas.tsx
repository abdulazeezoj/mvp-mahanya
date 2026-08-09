"use client";

import { useTheme } from "next-themes";
import { Application, BlurFilter, Graphics } from "pixi.js";
import * as React from "react";
import {
  crosswalkAnchors,
  DIRECTIONS,
  junctionCenter,
  offsetRibbon,
  signalPositions,
  signalStateFor,
  toSceneSpace,
  VEHICLE_SHAPE,
  VEHICLE_SIZE_SCALE,
} from "@/lib/junction-scene";
import type { NetworkGeometry, TrafficState, VehicleType } from "@/lib/types";

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

// Real-world material colors (asphalt, road paint, signal housing) read
// consistently regardless of the app's light/dark theme — unlike UI
// surface colors, these don't need to invert, only the canvas background
// and vehicle/plaza tinting adapt to theme.
const ASPHALT = 0x48494b;
const ASPHALT_SHOULDER = 0x3a3b3d;
const ROAD_PAINT = 0xf4f4f2;
const SIGNAL_HOUSING = 0x232326;

interface ThemeColors {
  background: number;
  plaza: number;
  vehicle: number;
  vehicleAlpha: number;
  vehicleOutline: number;
  housingOutline: number;
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
  };
}

function fitTransform(
  canvasW: number,
  canvasH: number,
  sceneW: number,
  sceneH: number,
) {
  const scale = Math.min(canvasW / sceneW, canvasH / sceneH) || 1;
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
  const sceneRef = React.useRef<Graphics | null>(null);
  const vehicleLayerRef = React.useRef<Graphics | null>(null);
  const signalGraphicsRef = React.useRef<
    Partial<Record<string, { head: Graphics; halo: Graphics }>>
  >({});
  const vehiclesRef = React.useRef<Map<string, VehicleSprite>>(new Map());
  const geometryRef = React.useRef(geometry);
  const colorsRef = React.useRef<ThemeColors | null>(null);
  const { resolvedTheme } = useTheme();

  geometryRef.current = geometry;

  const drawStatic = React.useCallback((colors: ThemeColors) => {
    const app = appRef.current;
    const scene = sceneRef.current;
    if (!app || !scene) return;
    const geo = geometryRef.current;
    const { bounds } = geo;
    const roadWidth =
      Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.08;

    scene.clear();

    // A solid paved plaza under the crossing point, drawn first so the
    // road ribbons and crosswalks lay cleanly on top of one continuous
    // asphalt surface instead of leaving visible seams at the mouth.
    const junctionMid = junctionCenter(geo);
    const center = toSceneSpace(bounds, [junctionMid.x, junctionMid.y]);
    const plazaRadius = roadWidth * 1.05;
    scene.circle(center[0], center[1], plazaRadius).fill(ASPHALT);
    scene
      .circle(center[0], center[1], plazaRadius)
      .stroke({ width: roadWidth * 0.02, color: ASPHALT_SHOULDER, alpha: 0.6 });
    // Soft theme-tinted glow behind the plaza for depth, subtle enough not
    // to read as its own shape.
    scene
      .circle(center[0], center[1], plazaRadius * 1.6)
      .fill({ color: colors.plaza, alpha: 0.08 });

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
      const light = toSceneSpace(bounds, pos.light);
      const stop = toSceneSpace(bounds, pos.stop);
      scene
        .moveTo(stop[0], stop[1])
        .lineTo(light[0], light[1])
        .stroke({
          width: lightRadius * 0.15,
          color: ASPHALT_SHOULDER,
          alpha: 0.7,
        });
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
      const roadWidth = extent * 0.08;
      const lightRadius = extent * 0.02;
      const positions = signalPositions(geo, roadWidth);

      const housingW = lightRadius * 1.9;
      const housingH = lightRadius * 5.6;
      const lampGap = housingH / 3;

      for (const direction of DIRECTIONS) {
        const pos = positions[direction];
        if (!pos) continue;
        let entry = signalGraphicsRef.current[direction];
        if (!entry) {
          const halo = new Graphics();
          halo.filters = [new BlurFilter({ strength: 6 })];
          const head = new Graphics();
          sceneRef.current?.addChild(halo, head);
          entry = { halo, head };
          signalGraphicsRef.current[direction] = entry;
        }
        const light = toSceneSpace(bounds, pos.light);
        const state = signalStateFor(direction, trafficState?.activePhase);
        const isActive = state !== "red";

        entry.halo.clear();
        entry.halo.visible = isActive;
        if (isActive) {
          entry.halo
            .circle(light[0], light[1], lightRadius * 2.4)
            .fill({ color: SIGNAL_COLOR[state], alpha: 0.55 });
        }

        entry.head.clear();
        entry.head
          .roundRect(
            light[0] - housingW / 2,
            light[1] - housingH / 2,
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
          const lampY = light[1] - housingH / 2 + lampGap * (i + 0.5);
          const isOn = lampState === state;
          entry.head.circle(light[0], lampY, lightRadius * 0.6).fill({
            color: isOn ? SIGNAL_COLOR[lampState] : 0x000000,
            alpha: isOn ? 1 : 0.4,
          });
        });
      }
    },
    [trafficState?.activePhase],
  );

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounts the Pixi Application exactly once; drawStatic/drawSignals are invoked by the effects below on subsequent updates via refs, not re-run here.
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

        const scene = new Graphics();
        const vehicleLayer = new Graphics();
        app.stage.addChild(scene);
        app.stage.addChild(vehicleLayer);
        sceneRef.current = scene;
        vehicleLayerRef.current = vehicleLayer;

        const colors = resolveThemeColors();
        colorsRef.current = colors;
        app.renderer.background.color = colors.background;
        drawStatic(colors);

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
          app.stage.scale.set(scale);
          app.stage.position.set(offsetX, offsetY);

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
      vehicleLayerRef.current = null;
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
    drawStatic(colors);
    drawSignals(colors);
  }, [resolvedTheme, drawStatic, drawSignals]);

  React.useEffect(() => {
    if (!appRef.current || !colorsRef.current) return;
    drawSignals(colorsRef.current);
  }, [drawSignals]);

  React.useEffect(() => {
    if (!appRef.current || !colorsRef.current) return;
    syncVehicles(colorsRef.current);
  }, [syncVehicles]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="aspect-square w-full max-w-3xl overflow-hidden rounded-lg border border-border"
    />
  );
}
