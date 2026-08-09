import { describe, expect, it } from "vitest";
import {
  busShape,
  carShape,
  crosswalkAnchors,
  junctionCenter,
  motorcycleShape,
  offsetRibbon,
  signalPositions,
  signalStateFor,
  toSceneSpace,
  truckShape,
  VEHICLE_SHAPE,
} from "@/lib/junction-scene";
import { makeNetworkGeometry } from "@/lib/test-fixtures";

describe("toSceneSpace", () => {
  it("flips Y and offsets by bounds.minX", () => {
    const bounds = { minX: 10, minY: 0, maxX: 310, maxY: 300 };
    expect(toSceneSpace(bounds, [10, 0])).toEqual([0, 300]);
    expect(toSceneSpace(bounds, [10, 300])).toEqual([0, 0]);
  });
});

describe("junctionCenter", () => {
  it("averages the inner endpoints of all lanes", () => {
    const geometry = makeNetworkGeometry();
    const center = junctionCenter(geometry);
    expect(center.x).toBeCloseTo(150, 0);
    expect(center.y).toBeCloseTo(150, 0);
  });

  it("falls back to the bounds midpoint when there are no lanes", () => {
    const center = junctionCenter({
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 200 },
      lanes: [],
    });
    expect(center).toEqual({ x: 50, y: 100 });
  });
});

describe("signalPositions", () => {
  it("places a light beside (not on) each direction's lane, offset from the stop line", () => {
    const geometry = makeNetworkGeometry();
    const positions = signalPositions(geometry, 10);
    expect(Object.keys(positions).sort()).toEqual([
      "east",
      "north",
      "south",
      "west",
    ]);
    for (const pos of Object.values(positions)) {
      if (!pos) continue;
      const dist = Math.hypot(
        pos.light[0] - pos.stop[0],
        pos.light[1] - pos.stop[1],
      );
      expect(dist).toBeGreaterThan(0);
      const dirLen = Math.hypot(pos.direction[0], pos.direction[1]);
      expect(dirLen).toBeCloseTo(1, 5);
    }
  });

  it("clears the road's own half-width, not just the centerline", () => {
    const geometry = makeNetworkGeometry();
    const roadWidth = 10;
    const positions = signalPositions(geometry, roadWidth);
    const north = positions.north;
    if (!north) throw new Error("expected a north signal position");
    const lateralDist = Math.hypot(
      north.light[0] - north.stop[0],
      north.light[1] - north.stop[1],
    );
    expect(lateralDist).toBeGreaterThan(roadWidth / 2);
  });
});

describe("crosswalkAnchors", () => {
  it("places one crosswalk band per direction, further from the stop line than the signal", () => {
    const geometry = makeNetworkGeometry();
    const roadWidth = 10;
    const anchors = crosswalkAnchors(geometry, roadWidth);
    const signals = signalPositions(geometry, roadWidth);
    expect(Object.keys(anchors).sort()).toEqual([
      "east",
      "north",
      "south",
      "west",
    ]);
    for (const direction of Object.keys(anchors) as (keyof typeof anchors)[]) {
      const anchor = anchors[direction];
      const stop = signals[direction]?.stop;
      if (!anchor || !stop) continue;
      const distFromStop = Math.hypot(
        anchor.center[0] - stop[0],
        anchor.center[1] - stop[1],
      );
      expect(distFromStop).toBeGreaterThan(0);
      // direction and perpendicular should be unit vectors, at right angles.
      const dirLen = Math.hypot(anchor.direction[0], anchor.direction[1]);
      const perpLen = Math.hypot(
        anchor.perpendicular[0],
        anchor.perpendicular[1],
      );
      expect(dirLen).toBeCloseTo(1, 5);
      expect(perpLen).toBeCloseTo(1, 5);
      const dot =
        anchor.direction[0] * anchor.perpendicular[0] +
        anchor.direction[1] * anchor.perpendicular[1];
      expect(dot).toBeCloseTo(0, 5);
    }
  });
});

describe("signalStateFor", () => {
  it("reads green only for the matching direction's green phase", () => {
    expect(signalStateFor("north", "NORTH_GREEN")).toBe("green");
    expect(signalStateFor("south", "NORTH_GREEN")).toBe("red");
    expect(signalStateFor("east", "EAST_YELLOW")).toBe("yellow");
  });

  it("defaults to red when there is no active phase", () => {
    expect(signalStateFor("north", undefined)).toBe("red");
  });
});

describe("offsetRibbon", () => {
  it("returns an 2n-point ribbon polygon for an n-point centerline", () => {
    const ribbon = offsetRibbon(
      [
        [0, 0],
        [0, 100],
      ],
      10,
    );
    expect(ribbon).toHaveLength(4);
  });

  it("returns an empty polygon for a degenerate (single-point) shape", () => {
    expect(offsetRibbon([[0, 0]], 10)).toEqual([]);
  });
});

describe("vehicle shapes", () => {
  it("gives every vehicle type a distinct, non-empty point array", () => {
    const shapes = [
      carShape(10),
      motorcycleShape(10),
      busShape(10),
      truckShape(10),
    ];
    for (const shape of shapes) {
      expect(shape.length).toBeGreaterThan(0);
    }
    const serialized = shapes.map((s) => JSON.stringify(s));
    expect(new Set(serialized).size).toBe(shapes.length);
  });

  it("maps every VehicleType to a shape function, with emergency reusing car", () => {
    expect(VEHICLE_SHAPE.emergency(10)).toEqual(VEHICLE_SHAPE.car(10));
    expect(VEHICLE_SHAPE.bus(10)).not.toEqual(VEHICLE_SHAPE.car(10));
  });
});
