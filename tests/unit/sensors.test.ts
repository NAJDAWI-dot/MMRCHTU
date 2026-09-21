import { describe, expect, it } from "vitest";
import { narrowestGapMm } from "@/lib/micromouse";
import {
  SENSORS,
  SENSOR_RANGE_MM,
  castRay,
  layoutSegments,
  readAll,
  steering,
  toWorld,
} from "@/lib/sensors";

const HALF = narrowestGapMm() / 2;
const corridor = layoutSegments("corridor");

describe("casting a ray at a wall", () => {
  it("measures straight ahead", () => {
    // A wall across the corridor at y = 90, from a sensor at the origin.
    const wall = [{ x1: -HALF, y1: 90, x2: HALF, y2: 90 }];
    expect(castRay([0, 0], 0, wall)).toBeCloseTo(90, 5);
  });

  it("measures sideways, and knows which side", () => {
    expect(castRay([0, 0], -90, corridor)).toBeCloseTo(HALF, 5);
    expect(castRay([0, 0], 90, corridor)).toBeCloseTo(HALF, 5);
    expect(castRay([20, 0], -90, corridor)).toBeCloseTo(HALF + 20, 5);
  });

  it("sees nothing behind it", () => {
    const wall = [{ x1: -HALF, y1: -90, x2: HALF, y2: -90 }];
    expect(castRay([0, 0], 0, wall)).toBeNull();
  });

  it("never meets a wall it is parallel to", () => {
    // Straight down a corridor: the side walls are in front of it forever and
    // it meets neither. Getting this wrong gives a front sensor that reports a
    // wall in every cell of the maze.
    expect(castRay([0, 0], 0, corridor)).toBeNull();
  });

  it("gives up past its range", () => {
    const far = [{ x1: -HALF, y1: SENSOR_RANGE_MM + 40, x2: HALF, y2: SENSOR_RANGE_MM + 40 }];
    expect(castRay([0, 0], 0, far)).toBeNull();
    expect(castRay([0, 0], 0, far, SENSOR_RANGE_MM + 80)).toBeCloseTo(SENSOR_RANGE_MM + 40, 5);
  });

  it("takes the nearest wall when two are in line", () => {
    const walls = [
      { x1: -HALF, y1: 120, x2: HALF, y2: 120 },
      { x1: -HALF, y1: 60, x2: HALF, y2: 60 },
    ];
    expect(castRay([0, 0], 0, walls)).toBeCloseTo(60, 5);
  });
});

describe("placing the sensors", () => {
  it("leaves a point where it is when the mouse is square", () => {
    expect(toWorld({ x: 10, y: 20, heading: 0 }, [5, 5])).toEqual([15, 25]);
  });

  it("swings them round as the mouse turns", () => {
    const [x, y] = toWorld({ x: 0, y: 0, heading: 90 }, [0, 10]);
    // Ten millimetres ahead of a mouse facing right is ten to the right.
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
  });
});

describe("what the mouse sees", () => {
  const read = (pose: Parameters<typeof readAll>[0]) =>
    Object.fromEntries(readAll(pose, corridor).map((r) => [r.sensor.id, r.distance]));

  it("reads the same both sides down the middle", () => {
    const readings = read({ x: 0, y: 0, heading: 0 });
    expect(readings.left).toBeCloseTo(readings.right as number, 5);
    expect(readings.front).toBeNull();
  });

  it("reads closer on the side it has drifted towards", () => {
    const readings = read({ x: -20, y: 0, heading: 0 });
    expect(readings.left as number).toBeLessThan(readings.right as number);
    expect((readings.right as number) - (readings.left as number)).toBeCloseTo(40, 5);
  });

  it("gives every sensor a ray, hit or not", () => {
    const readings = readAll({ x: 0, y: 0, heading: 0 }, corridor);
    expect(readings).toHaveLength(SENSORS.length);
    for (const reading of readings) {
      expect(Number.isFinite(reading.to[0])).toBe(true);
      expect(Number.isFinite(reading.to[1])).toBe(true);
    }
  });

  it("sees the wall of a dead end ahead of it", () => {
    const readings = readAll({ x: 0, y: 0, heading: 0 }, layoutSegments("dead-end"));
    const front = readings.find((r) => r.sensor.id === "front")!;
    // The front sensor sits 48mm ahead of the middle of the mouse and the wall
    // is at 90.
    expect(front.distance).toBeCloseTo(42, 5);
  });

  it("loses the left wall at an opening", () => {
    const readings = readAll({ x: 0, y: 0, heading: 0 }, layoutSegments("left-opening"));
    const left = readings.find((r) => r.sensor.id === "left")!;
    const right = readings.find((r) => r.sensor.id === "right")!;
    expect(left.distance).toBeNull();
    expect(right.distance).toBeCloseTo(HALF - 32, 5);
  });
});

describe("steering from what it sees", () => {
  it("is happy in the middle of a corridor", () => {
    const drive = steering(readAll({ x: 0, y: 0, heading: 0 }, corridor));
    expect(drive.basis).toBe("both walls");
    expect(drive.error).toBeCloseTo(0, 5);
    expect(drive.correction).toBeCloseTo(0, 5);
  });

  it("pushes back towards the middle", () => {
    // Left of centre: the correction has to be positive, meaning bear right.
    const drive = steering(readAll({ x: -20, y: 0, heading: 0 }, corridor));
    expect(drive.error).toBeGreaterThan(0);
    expect(drive.correction).toBeGreaterThan(0);

    const other = steering(readAll({ x: 20, y: 0, heading: 0 }, corridor));
    expect(other.error).toBeLessThan(0);
  });

  it("falls back to one wall when that is all there is", () => {
    const drive = steering(readAll({ x: 0, y: 0, heading: 0 }, layoutSegments("left-opening")));
    expect(drive.basis).toBe("right wall");
  });

  it("says so when it has nothing to steer against", () => {
    // Both side walls open: the case that makes a gyroscope compulsory.
    const drive = steering(readAll({ x: 0, y: 0, heading: 0 }, layoutSegments("t-junction")));
    expect(drive.basis).toBe("nothing to see");
    expect(drive.error).toBe(0);
  });
});
