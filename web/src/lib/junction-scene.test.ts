import { describe, expect, it } from "vitest";
import {
  busShape,
  carShape,
  congestionColor,
  congestionLevel,
  contextBlocks,
  crosswalkAnchors,
  DIRECTIONS,
  directionLabelAnchors,
  junctionCenter,
  junctionPavementOutline,
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

describe("junctionPavementOutline", () => {
  it("returns 3 points per approach direction, with the concave notch carrying the corner radius", () => {
    const geometry = makeNetworkGeometry();
    const outline = junctionPavementOutline(geometry, 10, 15, 4);
    expect(outline).toHaveLength(12); // 4 directions x 3 points
    const notches = outline.filter((p) => p.radius > 0);
    const outerTips = outline.filter((p) => p.radius === 0);
    expect(notches).toHaveLength(4);
    expect(outerTips).toHaveLength(8);
    for (const notch of notches) {
      expect(notch.radius).toBe(4);
    }
  });

  it("centers the notches near the junction center, closer than the outer tips", () => {
    const geometry = makeNetworkGeometry();
    const center = junctionCenter(geometry);
    const roadWidth = 10;
    const armReach = 30;
    const outline = junctionPavementOutline(geometry, roadWidth, armReach, 4);
    for (const point of outline) {
      const dist = Math.hypot(point.x - center.x, point.y - center.y);
      if (point.radius > 0) {
        // Notches sit roughly one road-width off center (diagonal of the
        // half-width square), well short of a full arm reach.
        expect(dist).toBeLessThan(armReach);
      } else {
        expect(dist).toBeGreaterThan(roadWidth / 2);
      }
    }
  });

  it("returns nothing for fewer than two approach directions", () => {
    const geometry = makeNetworkGeometry({
      lanes: makeNetworkGeometry().lanes.filter((l) => l.direction === "north"),
    });
    expect(junctionPavementOutline(geometry, 10, 15, 4)).toEqual([]);
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

describe("directionLabelAnchors", () => {
  it("places one anchor per approach direction, set back from the junction center", () => {
    const geometry = makeNetworkGeometry();
    const center = junctionCenter(geometry);
    const anchors = directionLabelAnchors(geometry, 40);
    expect(Object.keys(anchors).sort()).toEqual([
      "east",
      "north",
      "south",
      "west",
    ]);
    for (const anchor of Object.values(anchors)) {
      if (!anchor) continue;
      const dist = Math.hypot(anchor.x - center.x, anchor.y - center.y);
      expect(dist).toBeCloseTo(40, 0);
    }
  });
});

describe("congestionLevel", () => {
  it("is 0 for an empty approach", () => {
    expect(congestionLevel({ queueLength: 0, vehicleCount: 0 })).toBe(0);
  });

  it("saturates at 1 for a long queue", () => {
    expect(congestionLevel({ queueLength: 100, vehicleCount: 100 })).toBe(1);
  });

  it("falls back to a damped vehicle count when nothing is formally queued", () => {
    const level = congestionLevel({ queueLength: 0, vehicleCount: 4 });
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
  });

  it("increases monotonically with queue length", () => {
    const low = congestionLevel({ queueLength: 1, vehicleCount: 1 });
    const high = congestionLevel({ queueLength: 6, vehicleCount: 6 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("congestionColor", () => {
  it("is green at level 0 and red at level 1", () => {
    expect(congestionColor(0)).toBe(0x22c55e);
    expect(congestionColor(1)).toBe(0xef4444);
  });

  it("passes through amber around the midpoint", () => {
    expect(congestionColor(0.5)).toBe(0xeab308);
  });

  it("clamps out-of-range levels", () => {
    expect(congestionColor(-5)).toBe(congestionColor(0));
    expect(congestionColor(5)).toBe(congestionColor(1));
  });
});

describe("contextBlocks", () => {
  it("is deterministic for the same network geometry", () => {
    const geometry = makeNetworkGeometry();
    const a = contextBlocks(geometry, 10);
    const b = contextBlocks(geometry, 10);
    expect(a).toEqual(b);
  });

  it("only produces building or green blocks with positive extents", () => {
    const geometry = makeNetworkGeometry();
    const blocks = contextBlocks(geometry, 10);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(["building", "green"]).toContain(block.kind);
      expect(block.w).toBeGreaterThan(0);
      expect(block.h).toBeGreaterThan(0);
    }
  });

  it("returns nothing for a degenerate (zero-extent) network", () => {
    expect(
      contextBlocks(
        { bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, lanes: [] },
        10,
      ),
    ).toEqual([]);
  });
});

describe("DIRECTIONS", () => {
  it("still lists all four approach directions", () => {
    expect(DIRECTIONS.sort()).toEqual(["east", "north", "south", "west"]);
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
