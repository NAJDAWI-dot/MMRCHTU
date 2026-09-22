import { narrowestGapMm } from "@/lib/micromouse";
import { RULES } from "@/lib/rules";

/**
 * What the mouse can see from where it is standing.
 *
 * The hardest thing to explain about a wall sensor is that it does not report
 * "wall" or "no wall". It reports a distance along one line, and everything
 * the mouse believes about the maze is inferred from five of those numbers
 * changing as it moves. A paragraph cannot show that. A mouse you can drag
 * around a cell, with the five rays moving with it, can.
 *
 * Plain geometry, no React and no DOM, so the awkward cases are testable: a
 * ray parallel to a wall, a ray pointing away from everything, a mouse turned
 * far enough that its left sensor is looking at the right wall.
 */

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Sensor {
  id: string;
  label: string;
  /** Where it sits on the mouse, in millimetres, forward being +y. */
  at: [number, number];
  /** Degrees from straight ahead. Negative points left. */
  angle: number;
  /** Which wall it is really there to watch. */
  reads: "left" | "right" | "front";
}

/** The five the guide recommends: two sides, two diagonals, one ahead. */
export const SENSORS: Sensor[] = [
  { id: "left", label: "Left", at: [-32, 46], angle: -90, reads: "left" },
  { id: "left-diag", label: "Left diagonal", at: [-17, 47], angle: -40, reads: "left" },
  { id: "front", label: "Front", at: [0, 48], angle: 0, reads: "front" },
  { id: "right-diag", label: "Right diagonal", at: [17, 47], angle: 40, reads: "right" },
  { id: "right", label: "Right", at: [32, 46], angle: 90, reads: "right" },
];

/** Past this an infrared pair returns noise, so the mouse calls it no wall. */
export const SENSOR_RANGE_MM = 170;

export type Layout = "corridor" | "left-opening" | "t-junction" | "dead-end";

export const LAYOUT_LABELS: Record<Layout, string> = {
  corridor: "Corridor",
  "left-opening": "Opening on the left",
  "t-junction": "T junction",
  "dead-end": "Dead end",
};

const CELL_MM = RULES.cellSizeCm * 10;

/**
 * The walls of one cell and its approaches, as line segments.
 *
 * Built around the origin with the mouse driving towards +y, so a reading is
 * about the mouse rather than about a corner of some grid. The run is three
 * cells long, which is enough for a side sensor to have something to look at
 * before and after the junction.
 */
export function layoutSegments(layout: Layout): Segment[] {
  const half = narrowestGapMm() / 2;
  const back = -CELL_MM;
  const front = CELL_MM * 1.5;

  // The mouse's own cell runs from -90 to +90, so an opening is a wall in two
  // pieces with that span missing from it.
  const gapFrom = -CELL_MM / 2;
  const gapTo = CELL_MM / 2;
  const segments: Segment[] = [];

  const side = (x: number, open: boolean) => {
    if (!open) {
      segments.push({ x1: x, y1: back, x2: x, y2: front });
      return;
    }
    segments.push({ x1: x, y1: back, x2: x, y2: gapFrom });
    segments.push({ x1: x, y1: gapTo, x2: x, y2: front });
  };

  side(-half, layout === "left-opening" || layout === "t-junction");
  side(half, layout === "t-junction");

  // The wall ahead, which only a dead end has.
  if (layout === "dead-end") {
    segments.push({ x1: -half, y1: gapTo, x2: half, y2: gapTo });
  }

  return segments;
}

export interface Pose {
  /** Across the corridor. 0 is the middle. */
  x: number;
  /** Along it. */
  y: number;
  /** Degrees. 0 is straight up the corridor. */
  heading: number;
}

export interface Reading {
  sensor: Sensor;
  /** Where the ray starts, in world millimetres. */
  from: [number, number];
  /** Where it ends: the wall it hit, or the end of its range. */
  to: [number, number];
  /** Millimetres to the wall, or null when nothing is in range. */
  distance: number | null;
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * A point on the mouse, placed into the world by its pose.
 *
 * Clockwise-positive, to agree with `castRay`: heading 0 faces +y and heading
 * 90 faces +x, the way a compass bearing works. The textbook rotation matrix
 * is counter-clockwise, and mixing the two gives a mouse whose body turns one
 * way while its sensor rays turn the other.
 */
export function toWorld(pose: Pose, point: [number, number]): [number, number] {
  const a = rad(pose.heading);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [pose.x + point[0] * cos + point[1] * sin, pose.y - point[0] * sin + point[1] * cos];
}

/**
 * How far along a ray the nearest wall is.
 *
 * Standard segment intersection, with the two degenerate cases written out
 * rather than left to chance: a ray parallel to a wall never meets it, and a
 * wall behind the sensor is not a reading. Both happen constantly once the
 * mouse is turned even slightly.
 */
export function castRay(
  from: [number, number],
  angleDeg: number,
  segments: Segment[],
  range = SENSOR_RANGE_MM,
): number | null {
  const a = rad(angleDeg);
  const dx = Math.sin(a);
  const dy = Math.cos(a);

  let nearest: number | null = null;

  for (const wall of segments) {
    const wx = wall.x2 - wall.x1;
    const wy = wall.y2 - wall.y1;
    const denominator = dx * wy - dy * wx;
    // Parallel. Even an exactly overlapping wall gives no crossing point.
    if (Math.abs(denominator) < 1e-9) continue;

    const t = ((wall.x1 - from[0]) * wy - (wall.y1 - from[1]) * wx) / denominator;
    const u = ((wall.x1 - from[0]) * dy - (wall.y1 - from[1]) * dx) / denominator;

    // t is distance along the ray, u is position along the wall.
    if (t < 0 || t > range) continue;
    if (u < 0 || u > 1) continue;
    if (nearest === null || t < nearest) nearest = t;
  }

  return nearest;
}

/** Every sensor's reading for one pose. */
export function readAll(pose: Pose, segments: Segment[]): Reading[] {
  return SENSORS.map((sensor) => {
    const from = toWorld(pose, sensor.at);
    const angle = pose.heading + sensor.angle;
    const distance = castRay(from, angle, segments);
    const reach = distance ?? SENSOR_RANGE_MM;
    const a = rad(angle);
    return {
      sensor,
      from,
      to: [from[0] + Math.sin(a) * reach, from[1] + Math.cos(a) * reach] as [number, number],
      distance,
    };
  });
}

export interface Steering {
  /** Positive means the mouse is left of centre and should bear right. */
  error: number;
  /** What the loop is working from, in words. */
  basis: "both walls" | "left wall" | "right wall" | "nothing to see";
  /** Correction the P term would add to one wheel and take off the other. */
  correction: number;
}

/**
 * The steering error, the way a mouse actually has to work it out.
 *
 * With both side walls in range it is the difference between them, which is
 * the easy case and the one every tutorial shows. Half the cells in a maze do
 * not have both. With one wall it has to steer to a remembered distance from
 * that wall, and with neither it has nothing to offer and the gyro has to hold
 * the line instead. Showing all four cases is the point: the fourth is why the
 * guide tells you to buy a gyroscope.
 */
export function steering(readings: Reading[], kp = 0.35): Steering {
  const left = readings.find((r) => r.sensor.id === "left")?.distance ?? null;
  const right = readings.find((r) => r.sensor.id === "right")?.distance ?? null;
  const ideal = narrowestGapMm() / 2;

  let error = 0;
  let basis: Steering["basis"] = "nothing to see";

  if (left !== null && right !== null) {
    error = right - left;
    basis = "both walls";
  } else if (left !== null) {
    error = 2 * (ideal - left);
    basis = "left wall";
  } else if (right !== null) {
    error = 2 * (right - ideal);
    basis = "right wall";
  }

  return { error: round(error), basis, correction: round(error * kp) };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
