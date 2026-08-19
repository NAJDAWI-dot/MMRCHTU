import { describe, expect, it } from "vitest";
import {
  LOADER_GRID,
  MOUSE_SPEED,
  SPLASH_GRID,
  generateMaze,
  mazeTiming,
  newLoaderMaze,
  newSplashMaze,
  pickMaze,
  routePacing,
  wallBands,
  type Maze,
  type Rand,
  type Route,
} from "@/lib/maze";

/**
 * The maze is different for every visitor, so it can never be eyeballed the
 * way a fixed one could. Correctness has to be asserted from the geometry
 * itself, over many draws — which is the point of testing the generator here
 * rather than only through the browser.
 */

/** Seeded PRNG, so a failure can be reproduced rather than merely re-rolled. */
function mulberry32(seed: number): Rand {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Segment {
  horizontal: boolean;
  /** The fixed coordinate: y for a horizontal segment, x for a vertical one. */
  at: number;
  from: number;
  to: number;
}

/** Wall runs are "M<x> <y>H<x2>" or "M<x> <y>V<y2>". */
function parseWall(d: string): Segment {
  const [a = 0, b = 0, c = 0] = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return d.includes("H")
    ? { horizontal: true, at: b, from: Math.min(a, c), to: Math.max(a, c) }
    : { horizontal: false, at: a, from: Math.min(b, c), to: Math.max(b, c) };
}

/** Routes are "M<x> <y>" followed by H/V commands, one per turn. */
function parseRoute(d: string): Segment[] {
  const tokens = d.trim().split(/\s+/);
  let x = Number(tokens[0]!.slice(1));
  let y = Number(tokens[1]!);
  const segments: Segment[] = [];

  for (const token of tokens.slice(2)) {
    const value = Number(token.slice(1));
    if (token[0] === "H") {
      segments.push({ horizontal: true, at: y, from: Math.min(x, value), to: Math.max(x, value) });
      x = value;
    } else {
      segments.push({ horizontal: false, at: x, from: Math.min(y, value), to: Math.max(y, value) });
      y = value;
    }
  }
  return segments;
}

/**
 * Counts places a route passes through a wall.
 *
 * Strict inequalities throughout: routes run along cell centres (10 + 20n) and
 * walls along cell boundaries (20n), so the two can only ever meet by properly
 * crossing. Touching at an endpoint is not possible and not tolerated here.
 */
function crossings(maze: Maze): number {
  const walls = maze.walls.map(parseWall);
  let count = 0;

  for (const route of maze.routes) {
    for (const seg of parseRoute(route.solution)) {
      for (const wall of walls) {
        if (seg.horizontal === wall.horizontal) continue;
        const [h, v] = seg.horizontal ? [seg, wall] : [wall, seg];
        if (h.from < v.at && v.at < h.to && v.from < h.at && h.at < v.to) count++;
      }
    }
  }
  return count;
}

/** A route of a given length, for exercising the pacing bounds directly. */
function stubRoute(pathLength: number): Route {
  return { start: { x: 10, y: 10 }, cells: 2, turns: 1, pathLength, solution: "M10 10 H30" };
}

function endOf(route: Route): { x: number; y: number } {
  const segments = parseRoute(route.solution);
  const last = segments[segments.length - 1]!;
  return last.horizontal
    ? { x: route.solution.trimEnd().endsWith(String(last.to)) ? last.to : last.from, y: last.at }
    : { x: last.at, y: route.solution.trimEnd().endsWith(String(last.to)) ? last.to : last.from };
}

describe("generateMaze", () => {
  it("rejects grids that cannot hold a centred 2x2 goal", () => {
    expect(() => generateMaze(15)).toThrow(/even/);
    expect(() => generateMaze(2)).toThrow(/at least 4/);
  });

  it("emits geometry matching the requested grid", () => {
    const maze = generateMaze(16, mulberry32(1));
    expect(maze.size).toBe(16);
    expect(maze.viewBox).toBe("0 0 320 320");
    // The 2x2 goal room, centred.
    expect(maze.goal).toEqual({ x: 140, y: 140, size: 40 });
  });

  it("is reproducible for a given sequence of random numbers", () => {
    const a = generateMaze(16, mulberry32(99));
    const b = generateMaze(16, mulberry32(99));
    expect(a.walls).toEqual(b.walls);
    expect(a.routes.map((r) => r.solution)).toEqual(b.routes.map((r) => r.solution));
  });

  it("draws a different maze each time it is left to Math.random", () => {
    const signatures = new Set(
      Array.from({ length: 24 }, () => generateMaze(16).walls.join("|")),
    );
    expect(signatures.size).toBe(24);
  });

  it("solves from all four corners", () => {
    const maze = generateMaze(16, mulberry32(7));
    expect(maze.routes).toHaveLength(4);
    // Corners of a 16x16 grid of 20px cells, at cell centres.
    const starts = maze.routes.map((r) => `${r.start.x},${r.start.y}`).sort();
    expect(starts).toEqual(["10,10", "10,310", "310,10", "310,310"]);
  });

  it("orders the routes longest first, so the lead mouse has the best run", () => {
    const maze = generateMaze(16, mulberry32(11));
    const lengths = maze.routes.map((r) => r.pathLength);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
  });

  it("parks every mouse on its own cell, so none is hidden on arrival", () => {
    for (let seed = 0; seed < 40; seed++) {
      const maze = generateMaze(16, mulberry32(seed));
      const parked = new Set(maze.routes.map((r) => JSON.stringify(endOf(r))));
      expect(parked.size, `seed ${seed}`).toBe(4);
      // All four parking spots lie inside the goal room.
      for (const route of maze.routes) {
        const { x, y } = endOf(route);
        expect(x).toBeGreaterThanOrEqual(maze.goal.x);
        expect(x).toBeLessThanOrEqual(maze.goal.x + maze.goal.size);
        expect(y).toBeGreaterThanOrEqual(maze.goal.y);
        expect(y).toBeLessThanOrEqual(maze.goal.y + maze.goal.size);
      }
    }
  });

  it("emits only axis-aligned moves", () => {
    // A diagonal would be silently flattened onto one axis by the emitter and
    // the drawn route would cut a corner through a wall.
    for (let seed = 0; seed < 40; seed++) {
      const maze = generateMaze(16, mulberry32(seed));
      for (const route of maze.routes) {
        expect(route.solution, `seed ${seed}`).toMatch(/^M-?\d+ -?\d+(?: [HV]-?\d+)+$/);
      }
    }
  });

  it("keeps every route inside the arena", () => {
    const maze = generateMaze(16, mulberry32(3));
    for (const route of maze.routes) {
      for (const seg of parseRoute(route.solution)) {
        expect(seg.from).toBeGreaterThanOrEqual(0);
        expect(seg.to).toBeLessThanOrEqual(320);
        expect(seg.at).toBeGreaterThanOrEqual(0);
        expect(seg.at).toBeLessThanOrEqual(320);
      }
    }
  });

  /**
   * The one invariant that actually matters, and the reason the generator is a
   * generator rather than a hand-drawn path: a mouse must never walk through a
   * wall. Run over enough draws that a rare carve cannot slip past.
   */
  it("never routes a mouse through a wall, over 200 random mazes", () => {
    let checked = 0;
    for (let seed = 0; seed < 200; seed++) {
      const maze = generateMaze(16, mulberry32(seed));
      expect(crossings(maze), `seed ${seed} crosses a wall`).toBe(0);
      checked += maze.routes.length;
    }
    // Guards against the audit silently passing because it parsed nothing.
    expect(checked).toBe(800);
  });

  it("never routes a mouse through a wall at loader size either", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(crossings(generateMaze(LOADER_GRID, mulberry32(seed))), `seed ${seed}`).toBe(0);
    }
  });
});

describe("pickMaze", () => {
  it("keeps the lead route inside the requested band", () => {
    for (let seed = 0; seed < 30; seed++) {
      const maze = pickMaze(16, 34, 60, 60, mulberry32(seed));
      const cells = maze.routes[0]!.cells;
      expect(cells, `seed ${seed}`).toBeGreaterThanOrEqual(34);
      expect(cells, `seed ${seed}`).toBeLessThanOrEqual(60);
    }
  });

  it("returns the closest attempt rather than spinning when the band is unreachable", () => {
    // No 16x16 lead route is 500 cells long, so every attempt misses.
    const maze = pickMaze(16, 500, 600, 5, mulberry32(1));
    expect(maze.routes).toHaveLength(4);
  });

  it("produces splash and loader mazes at the expected grids", () => {
    expect(newSplashMaze().size).toBe(SPLASH_GRID);
    expect(newLoaderMaze().size).toBe(LOADER_GRID);
  });
});

describe("pacing", () => {
  it("moves every mouse at the same speed", () => {
    for (let seed = 0; seed < 30; seed++) {
      const maze = pickMaze(16, 34, 60, 60, mulberry32(seed));
      const timing = mazeTiming(maze);
      const speeds = maze.routes.map((r) => {
        const { durationS } = routePacing(r, maze, timing);
        return r.pathLength / durationS;
      });
      // All four derive from one pace, so they should agree to floating error.
      expect(Math.max(...speeds) - Math.min(...speeds), `seed ${seed}`).toBeLessThan(1e-6);
    }
  });

  it("lands every mouse on the same beat", () => {
    for (let seed = 0; seed < 30; seed++) {
      const maze = pickMaze(16, 34, 60, 60, mulberry32(seed));
      const timing = mazeTiming(maze);
      const arrivals = maze.routes.map((r) => {
        const { durationS, delayS } = routePacing(r, maze, timing);
        return durationS + delayS;
      });
      expect(Math.max(...arrivals) - Math.min(...arrivals), `seed ${seed}`).toBeLessThan(1e-6);
    }
  });

  it("holds one pace across wildly different mazes", () => {
    // Without this the duration would be fixed and a long carve would sprint
    // while a short one crawled — the bug that randomness would have shipped.
    // Exact, not approximate: the run bounds are set outside what the maze
    // bands can produce precisely so they never quietly alter the pace.
    for (let seed = 0; seed < 60; seed++) {
      const maze = pickMaze(16, 34, 60, 60, mulberry32(seed));
      const lead = maze.routes[0]!;
      const { durationS } = routePacing(lead, maze, mazeTiming(maze));
      expect(lead.pathLength / durationS, `seed ${seed}`).toBeCloseTo(MOUSE_SPEED, 6);
    }
  });

  it("still bounds the run for a maze outside any sensible band", () => {
    // The bounds are a safety net, so prove the net is actually there.
    const tiny = mazeTiming({ ...generateMaze(16, mulberry32(1)), routes: [stubRoute(20)] });
    expect(tiny.runS).toBe(1.2);
    const huge = mazeTiming({ ...generateMaze(16, mulberry32(1)), routes: [stubRoute(90_000)] });
    expect(huge.runS).toBe(2.4);
  });

  it("orders the beats: mice run, goal lights, then the lockup rises", () => {
    const timing = mazeTiming(pickMaze(16, 34, 60, 60, mulberry32(5)));
    expect(timing.goalS).toBeGreaterThan(timing.leadInS);
    expect(timing.lockupS).toBeGreaterThan(timing.goalS);
    expect(timing.totalMs).toBeGreaterThan(timing.lockupS * 1000);
  });

  it("reports a total the splash can hold without cutting the run off", () => {
    for (let seed = 0; seed < 40; seed++) {
      const timing = mazeTiming(pickMaze(16, 34, 60, 60, mulberry32(seed)));
      // Must clear the last mouse's arrival, and stay within the splash clamp.
      expect(timing.totalMs).toBeGreaterThan((timing.leadInS + timing.runS) * 1000);
      expect(timing.totalMs).toBeGreaterThanOrEqual(2600);
      expect(timing.totalMs).toBeLessThanOrEqual(4400);
    }
  });
});

describe("wallBands", () => {
  it("keeps every wall exactly once", () => {
    const maze = generateMaze(16, mulberry32(2));
    const bands = wallBands(maze, 6);
    expect(bands).toHaveLength(6);
    expect(bands.flat().sort()).toEqual([...maze.walls].sort());
  });

  it("sweeps outward from the lead mouse's corner", () => {
    const maze = generateMaze(16, mulberry32(2));
    const bands = wallBands(maze, 6);
    const origin = maze.routes[0]!.start;
    const meanDistance = (band: string[]) =>
      band.reduce((sum, d) => {
        const seg = parseWall(d);
        const x = seg.horizontal ? (seg.from + seg.to) / 2 : seg.at;
        const y = seg.horizontal ? seg.at : (seg.from + seg.to) / 2;
        return sum + Math.hypot(x - origin.x, y - origin.y);
      }, 0) / band.length;

    const populated = bands.filter((b) => b.length > 0).map(meanDistance);
    // Each band sits further out than the one before it.
    for (let i = 1; i < populated.length; i++) {
      expect(populated[i]!).toBeGreaterThan(populated[i - 1]!);
    }
  });
});
