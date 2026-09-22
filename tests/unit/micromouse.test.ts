import { describe, expect, it } from "vitest";
import { generateMaze, seededRandom } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES, goalCells, isGoal, shortestPath, startCell } from "@/lib/rules";
import {
  GEOMETRY,
  MATCH_SECONDS,
  TIGHT_CLEAR_MM,
  UNREACHABLE,
  clearance,
  countTurns,
  floodFill,
  floodRoute,
  islandMaze,
  narrowestGapMm,
  planMatch,
  strategySpread,
  wallFollow,
} from "@/lib/micromouse";

const maze = (seed = 7) => generateMaze(RULES.mazeGrid, seededRandom(seed), DIAGRAM_BRAID);

describe("the gap a mouse has to drive down", () => {
  it("measures the corridor the cautious way, then takes the tolerance off it", () => {
    // 180mm pitch less a 12mm wall, less the rulebook's 5%.
    expect(TIGHT_CLEAR_MM).toBe(168);
    expect(narrowestGapMm()).toBe(159.6);
    expect(GEOMETRY.wallThicknessMm).toBe(RULES.wallThicknessMm);
  });

  it("gives a sensible mouse room on both sides", () => {
    const fit = clearance(100, 90);
    expect(fit.fits).toBe(true);
    expect(fit.spins).toBe(true);
    expect(fit.eachSideMm).toBe(29.8);
  });

  it("fails a mouse that is legal on paper but too wide for a corridor", () => {
    // Well inside the rulebook's 25cm footprint, and it still cannot drive.
    const fit = clearance(170, 170);
    expect(fit.fits).toBe(false);
    expect(fit.verdict).toMatch(/corridor at all/);
  });

  it("catches the one that fits a corridor and jams on its first turn", () => {
    const fit = clearance(120, 140);
    expect(fit.fits).toBe(true);
    expect(fit.spins).toBe(false);
    expect(fit.verdict).toMatch(/cannot turn on the spot/);
  });

  it("warns when there is almost nothing either side", () => {
    // Short enough to still turn on the spot, so the warning it gets is about
    // the gap rather than about the turn.
    expect(clearance(140, 60).verdict).toMatch(/very little either side/);
  });
});

describe("flood fill", () => {
  it("puts zero on the centre and counts outward", () => {
    const m = maze();
    const d = floodFill(m);
    for (const cell of goalCells(m)) expect(d[cell.y]![cell.x]).toBe(0);

    const start = startCell(m);
    const atStart = d[start.y]![start.x]!;
    expect(Number.isFinite(atStart)).toBe(true);
    expect(atStart).toBeGreaterThan(0);
  });

  it("agrees with the rulebook diagrams about how far the centre is", () => {
    // Same maze, same answer, by a different method: the shortest path's
    // length is the start's flood value plus the cell it starts on.
    for (const seed of [1, 2, 3, 12, 40]) {
      const m = maze(seed);
      const start = startCell(m);
      expect(floodFill(m)[start.y]![start.x]).toBe(shortestPath(m, start).length - 1);
    }
  });

  it("never steps through a wall on its way downhill", () => {
    for (const seed of [4, 5, 6, 21]) {
      const m = maze(seed);
      const route = floodRoute(m, floodFill(m));
      expect(route[0]).toEqual(startCell(m));
      expect(isGoal(m, route[route.length - 1]!)).toBe(true);
      for (let i = 1; i < route.length; i++) {
        const step = Math.abs(route[i]!.x - route[i - 1]!.x) + Math.abs(route[i]!.y - route[i - 1]!.y);
        expect(step).toBe(1);
      }
    }
  });

  it("drives the shortest route there is", () => {
    for (const seed of [8, 9, 10]) {
      const m = maze(seed);
      expect(floodRoute(m, floodFill(m))).toHaveLength(shortestPath(m, startCell(m)).length);
    }
  });

  it("prefers to keep going straight when two routes are the same length", () => {
    // Turning costs seconds the cell count cannot see.
    const m = maze(3);
    const route = floodRoute(m, floodFill(m));
    const naive = shortestPath(m, startCell(m));
    expect(countTurns(route)).toBeLessThanOrEqual(countTurns(naive));
  });

  it("marks what the walls shut off as unreachable", () => {
    const m = maze();
    // A sealed cell: every wall up, nothing gets in.
    const sealed = { ...m, cells: m.cells.map(() => [true, true, true, true] as [boolean, boolean, boolean, boolean]) };
    const d = floodFill(sealed);
    expect(d[0]![0]).toBe(UNREACHABLE);
  });

  it("counts turns the way a driver would", () => {
    expect(countTurns([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(0);
    expect(countTurns([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toBe(1);
    expect(countTurns([{ x: 0, y: 0 }])).toBe(0);
  });
});

describe("keeping one hand on the wall", () => {
  it("walks every wall of a maze whose walls all join up", () => {
    // Worth stating plainly, because it is the half of the rule that is true:
    // in a maze with no island, a hand on the wall does eventually get there.
    // It is the island that beats it, not the maze.
    const perfect = generateMaze(RULES.mazeGrid, seededRandom(11), 0);
    expect(wallFollow(perfect, "left", 800).reachedGoal).toBe(true);
  });

  it("never finds an island centre, however long it walks", () => {
    // The rulebook's warning, checked rather than repeated.
    for (const seed of [1, 2, 3, 4, 5]) {
      const { maze: m, isIsland } = islandMaze(() => maze(seed * 97));
      if (!isIsland) continue;
      for (const hand of ["left", "right"] as const) {
        expect(wallFollow(m, hand, 800).reachedGoal).toBe(false);
      }
    }
  });

  it("finds an island to demonstrate on", () => {
    // The generator does not promise one, so the guide picks. If this ever
    // fails, the demonstration is quietly teaching the opposite of the rule.
    const rand = seededRandom(3);
    const { isIsland } = islandMaze(() => generateMaze(RULES.mazeGrid, rand, DIAGRAM_BRAID));
    expect(isIsland).toBe(true);
  });

  it("ends up provably going round in circles", () => {
    const { maze: m } = islandMaze(() => maze(2));
    const walk = wallFollow(m, "left", 800);
    expect(walk.looped).toBe(true);
    expect(walk.path.length).toBeGreaterThan(4);
  });

  it("walks a real path, one cell at a time", () => {
    const walk = wallFollow(maze(5), "right", 200);
    for (let i = 1; i < walk.path.length; i++) {
      const step =
        Math.abs(walk.path[i]!.x - walk.path[i - 1]!.x) + Math.abs(walk.path[i]!.y - walk.path[i - 1]!.y);
      expect(step).toBe(1);
    }
  });
});

describe("spending the eight minutes", () => {
  it("knows how long the match is", () => {
    expect(MATCH_SECONDS).toBe(480);
  });

  it("counts the runs that fit, and scores them the rulebook's way", () => {
    const plan = planMatch({ searchSeconds: 120, speedSeconds: 25, resetSeconds: 15 });
    // 120 + 15 for the search, then 40 a run: eight more fit inside 480.
    expect(plan.runs).toBe(9);
    expect(plan.officialSeconds).toBe(25);
    expect(plan.score).toBeCloseTo(360, 1);
    expect(plan.usedSeconds).toBe(455);
    expect(plan.spareSeconds).toBe(25);
  });

  it("charges the reset at the same rate as the driving", () => {
    const brisk = planMatch({ searchSeconds: 120, speedSeconds: 25, resetSeconds: 5 });
    const slow = planMatch({ searchSeconds: 120, speedSeconds: 25, resetSeconds: 30 });
    expect(brisk.runs).toBeGreaterThan(slow.runs);
    expect(brisk.score!).toBeGreaterThan(slow.score!);
  });

  it("never counts a run that would not have finished in time", () => {
    const plan = planMatch({ searchSeconds: 400, speedSeconds: 60, resetSeconds: 20 });
    expect(plan.runs).toBe(1);
    expect(plan.usedSeconds).toBeLessThanOrEqual(MATCH_SECONDS);
    expect(plan.officialSeconds).toBe(400);
  });

  it("says so when the search alone will not fit", () => {
    const plan = planMatch({ searchSeconds: 600, speedSeconds: 20, resetSeconds: 10 });
    expect(plan.overruns).toBe(true);
    expect(plan.runs).toBe(0);
    expect(plan.score).toBeNull();
  });

  it("shows that repeating beats one flawless run", () => {
    // The whole strategy section in one assertion. Same mouse, same times; the
    // only difference is whether it keeps going.
    const { careful, repeated } = strategySpread({
      searchSeconds: 90,
      speedSeconds: 22,
      resetSeconds: 12,
    });
    expect(careful.runs).toBe(2);
    expect(repeated.runs).toBeGreaterThan(careful.runs);
    expect(repeated.score!).toBeGreaterThan(careful.score!);
    expect(repeated.officialSeconds).toBe(careful.officialSeconds);
  });
});
