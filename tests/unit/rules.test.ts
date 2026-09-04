import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIRS, generateMaze, type Cell, type Maze } from "@/lib/maze";
import {
  CHECKLIST,
  CHECKLIST_GROUPS,
  DIAGRAM_BRAID,
  RULES,
  checklistReport,
  checklistSummary,
  checklistVerdict,
  compareRuns,
  finalScore,
  footprintCheck,
  formatScore,
  goalCells,
  pathData,
  searchRun,
  shortestPath,
  startCell,
} from "@/lib/rules";

/**
 * The thing that has to be true of every drawn route: consecutive cells are
 * neighbours, and the wall between them is actually absent. A path that looks
 * plausible but steps through a wall would teach the reader something false,
 * which is worse than the prose it replaced.
 */
function assertWalkable(maze: Maze, path: Cell[]) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dir = DIRS.find((d) => a.x + d.dx === b.x && a.y + d.dy === b.y);
    expect(dir, `${a.x},${a.y} -> ${b.x},${b.y} is not a single step`).toBeDefined();
    expect(
      maze.cells[a.y * maze.size + a.x]![dir!.wall],
      `route crosses a wall at ${a.x},${a.y}`,
    ).toBe(false);
  }
}

const inGoal = (maze: Maze, c: Cell) => goalCells(maze).some((g) => g.x === c.x && g.y === c.y);

describe("footprintCheck", () => {
  it("passes a mouse inside the footprint limit", () => {
    const check = footprintCheck(10, 12);
    expect(check.valid).toBe(true);
    expect(check.withinFootprint).toBe(true);
  });

  it("fails a mouse over the limit on either side", () => {
    expect(footprintCheck(26, 10).withinFootprint).toBe(false);
    expect(footprintCheck(10, 26).withinFootprint).toBe(false);
  });

  it("allows a mouse sitting exactly on the limit", () => {
    const check = footprintCheck(RULES.maxFootprintCm, RULES.maxFootprintCm);
    expect(check.withinFootprint).toBe(true);
  });

  it("measures corner to corner, not side to side", () => {
    expect(footprintCheck(3, 4).diagonalCm).toBe(5);
  });

  it("reports the turning clearance left inside a cell", () => {
    const check = footprintCheck(9, 12); // 15cm diagonal
    expect(check.diagonalCm).toBe(15);
    expect(check.turnsInsideCell).toBe(true);
    expect(check.turnClearanceCm).toBe(RULES.cellSizeCm - 15);
  });

  it("flags a legal mouse that still cannot turn in a cell", () => {
    // The gap the rulebook leaves open: within 25x25, wider than an 18cm cell.
    const check = footprintCheck(20, 20);
    expect(check.withinFootprint).toBe(true);
    expect(check.turnsInsideCell).toBe(false);
    expect(check.turnClearanceCm).toBeLessThan(0);
  });

  it("treats missing or impossible dimensions as invalid", () => {
    for (const [w, l] of [
      [0, 10],
      [10, 0],
      [-5, 10],
      [Number.NaN, 10],
      [10, Number.POSITIVE_INFINITY],
    ]) {
      const check = footprintCheck(w!, l!);
      expect(check.valid).toBe(false);
      expect(check.withinFootprint).toBe(false);
    }
  });
});

describe("maze geography", () => {
  const maze = generateMaze(16, () => 0.5);

  it("puts the goal in the middle as a 2x2 room", () => {
    expect(goalCells(maze)).toEqual([
      { x: 7, y: 7 },
      { x: 8, y: 7 },
      { x: 7, y: 8 },
      { x: 8, y: 8 },
    ]);
  });

  it("starts the mouse in a corner", () => {
    expect(startCell(maze)).toEqual({ x: 0, y: 15 });
  });

  it("exposes a walkable wall grid, not just the drawn runs", () => {
    expect(maze.cells).toHaveLength(16 * 16);
    expect(maze.cells[0]).toHaveLength(4);
  });
});

describe("searchRun", () => {
  it("finds the goal and stops there", () => {
    const maze = generateMaze(16);
    const run = searchRun(maze);
    expect(run.reachedGoal).toBe(true);
    expect(inGoal(maze, run.visited[run.visited.length - 1]!)).toBe(true);
  });

  it("never records a cell twice", () => {
    const maze = generateMaze(16);
    const run = searchRun(maze);
    const seen = new Set(run.visited.map((c) => `${c.x},${c.y}`));
    expect(seen.size).toBe(run.visited.length);
  });

  it("counts backtracking, so moves are never fewer than cells found", () => {
    const maze = generateMaze(16);
    const run = searchRun(maze);
    expect(run.moves).toBeGreaterThanOrEqual(run.visited.length - 1);
  });

  it("is stable for a given maze, so the diagram does not shift under the reader", () => {
    const maze = generateMaze(16);
    expect(searchRun(maze)).toEqual(searchRun(maze));
  });

  it("does no work when it starts in the goal", () => {
    const maze = generateMaze(16);
    const run = searchRun(maze, { x: 8, y: 8 });
    expect(run.moves).toBe(0);
    expect(run.visited).toHaveLength(1);
  });
});

describe("shortestPath", () => {
  it("returns a walkable route into the goal", () => {
    const maze = generateMaze(16);
    const path = shortestPath(maze, startCell(maze));
    expect(path[0]).toEqual(startCell(maze));
    expect(inGoal(maze, path[path.length - 1]!)).toBe(true);
    assertWalkable(maze, path);
  });

  it("respects the cells it is restricted to", () => {
    const maze = generateMaze(16);
    const known = new Set(searchRun(maze).visited.map((c) => c.y * maze.size + c.x));
    const path = shortestPath(maze, startCell(maze), known);
    expect(path.length).toBeGreaterThan(0);
    for (const c of path) expect(known.has(c.y * maze.size + c.x)).toBe(true);
  });

  it("gives up rather than inventing a route it is not allowed", () => {
    const maze = generateMaze(16);
    const start = startCell(maze);
    expect(shortestPath(maze, start, new Set())).toEqual([]);
    expect(shortestPath(maze, start, new Set([start.y * maze.size + start.x]))).toEqual([]);
  });
});

describe("compareRuns", () => {
  it("cannot beat the unrestricted route using only what it found", () => {
    const maze = generateMaze(16);
    const cmp = compareRuns(maze);
    expect(cmp.speed.length).toBeGreaterThanOrEqual(cmp.optimal.length);
    expect(cmp.cellsLost).toBe(cmp.speed.length - cmp.optimal.length);
    expect(cmp.cellsLost).toBeGreaterThanOrEqual(0);
  });

  it("draws only legal routes, over a hundred random mazes", () => {
    for (let i = 0; i < 100; i++) {
      const maze = generateMaze(16);
      const cmp = compareRuns(maze);
      expect(cmp.search.reachedGoal).toBe(true);
      expect(cmp.speed.length).toBeGreaterThan(0);
      assertWalkable(maze, cmp.speed);
      assertWalkable(maze, cmp.optimal);
      expect(inGoal(maze, cmp.speed[cmp.speed.length - 1]!)).toBe(true);
      expect(inGoal(maze, cmp.optimal[cmp.optimal.length - 1]!)).toBe(true);
    }
  });
});

/**
 * The figure exists to show that a careless search costs you a slower speed
 * run. These pin that it actually can — the first version of this diagram was
 * incapable of showing it, and looked completely fine.
 */
describe("the lesson the run figure teaches", () => {
  it("cannot be shown in a perfect maze, which is why braiding exists", () => {
    // One route between any two cells, so any search that reached the goal
    // walked the only route there and the speed run is always ideal.
    for (let i = 0; i < 40; i++) {
      expect(compareRuns(generateMaze(RULES.mazeGrid)).cellsLost).toBe(0);
    }
  });

  it("shows a real cost in most braided mazes", () => {
    let costly = 0;
    for (let i = 0; i < 120; i++) {
      const maze = generateMaze(RULES.mazeGrid, Math.random, DIAGRAM_BRAID);
      const cmp = compareRuns(maze);
      assertWalkable(maze, cmp.speed);
      assertWalkable(maze, cmp.optimal);
      if (cmp.cellsLost > 0) costly++;
    }
    // Measured at ~76% over 300 mazes at the 10x10 grid; the bound is loose
    // enough not to be flaky and tight enough to catch the diagram going inert.
    expect(costly).toBeGreaterThan(60);
  });
});

describe("pathData", () => {
  it("emits nothing for an empty route rather than a broken path", () => {
    expect(pathData([])).toBe("");
  });

  it("moves to the first cell centre and lines to the rest", () => {
    expect(pathData([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe("M10 10 L30 10");
  });
});

describe("checklistSummary", () => {
  it("starts empty", () => {
    const summary = checklistSummary({});
    expect(summary.state).toBe("empty");
    expect(summary.confirmed).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.outstanding).toHaveLength(CHECKLIST.length);
  });

  it("is ready only when everything is confirmed", () => {
    const all = Object.fromEntries(CHECKLIST.map((item) => [item.id, true]));
    const summary = checklistSummary(all);
    expect(summary.state).toBe("ready");
    expect(summary.percent).toBe(100);
    expect(summary.blockers).toHaveLength(0);
  });

  it("calls a team blocked while a disqualifying item is outstanding", () => {
    const answers = Object.fromEntries(CHECKLIST.map((item) => [item.id, true]));
    answers["self-contained"] = false;
    const summary = checklistSummary(answers);
    expect(summary.state).toBe("blocked");
    expect(summary.blockers.map((b) => b.id)).toEqual(["self-contained"]);
  });

  it("separates a legal team from a fully prepared one", () => {
    const answers = Object.fromEntries(CHECKLIST.map((item) => [item.id, true]));
    answers["match-plan"] = false;
    const summary = checklistSummary(answers);
    expect(summary.state).toBe("almost");
    expect(summary.blockers).toHaveLength(0);
    expect(summary.outstanding.map((o) => o.id)).toEqual(["match-plan"]);
  });

  it("ignores answers for items that are not on the list", () => {
    const summary = checklistSummary({ "not-a-rule": true });
    expect(summary.confirmed).toBe(0);
  });
});

describe("checklistVerdict", () => {
  const verdictFor = (answers: Record<string, boolean>) =>
    checklistVerdict(checklistSummary(answers));

  it("counts blockers in the singular and the plural", () => {
    const answers = Object.fromEntries(CHECKLIST.map((item) => [item.id, true]));
    answers["enrolled"] = false;
    expect(verdictFor({ ...answers })).toContain("1 item would stop you");
    answers["one-mouse"] = false;
    expect(verdictFor({ ...answers })).toContain("2 items would stop you");
  });

  it("says so plainly when the team is ready", () => {
    const all = Object.fromEntries(CHECKLIST.map((item) => [item.id, true]));
    expect(verdictFor(all)).toContain("Ready to compete");
  });
});

describe("checklistReport", () => {
  it("marks confirmed items and leaves the rest open", () => {
    const report = checklistReport({ enrolled: true });
    expect(report).toContain("[x] Every member is a currently enrolled university student");
    expect(report).toContain("[ ] The team is entering exactly one micromouse");
  });

  it("covers every item, under a heading for every group", () => {
    const report = checklistReport({});
    for (const item of CHECKLIST) expect(report).toContain(item.label);
    for (const group of CHECKLIST_GROUPS) expect(report).toContain(`${group}:`);
  });
});

describe("the checklist against the rulebook", () => {
  it("groups every item under a heading that is rendered", () => {
    for (const item of CHECKLIST) expect(CHECKLIST_GROUPS).toContain(item.group);
  });

  it("gives every item a unique id, so answers cannot collide", () => {
    const ids = new Set(CHECKLIST.map((item) => item.id));
    expect(ids.size).toBe(CHECKLIST.length);
  });

  /**
   * The numbers in RULES drive the diagrams; the numbers in the rulebook are
   * what entrants are held to. If someone edits one and not the other, the page
   * contradicts itself in public — so the two are pinned together here.
   */
  it("quotes the same numbers the prose does", () => {
    const rulebook = readFileSync(
      path.resolve(process.cwd(), "content/rules/rulebook.mdx"),
      "utf8",
    );

    expect(rulebook).toContain(`${RULES.mazeGrid}×${RULES.mazeGrid}`);
    expect(rulebook).toContain(`${RULES.cellSizeCm}cm cells`);
    expect(rulebook).toContain(`${RULES.wallThicknessMm}mm-thick walls`);
    expect(rulebook).toContain(`${RULES.latticePostCm}cm lattice post`);
    expect(rulebook).toContain(`${RULES.maxFootprintCm}cm × ${RULES.maxFootprintCm}cm`);
    expect(rulebook).toContain(`${RULES.matchMinutes} minutes`);
    expect(rulebook).toContain(`× ${RULES.scoreMultiplier}`);

    // Written out as words in the prose, where digits would read badly.
    const words: Record<number, string> = { 3: "three", 4: "four" };
    expect(rulebook).toContain(`up to ${words[RULES.maxTeamSize]}`);
  });
});

describe("finalScore", () => {
  /**
   * Both figures come straight out of rulebook 1.1's worked example. They are
   * here rather than in a comment because they are the case the formula exists
   * to settle: the slower mouse wins, and nobody believes that until they see
   * the two numbers side by side.
   */
  it("reproduces the rulebook's own worked example", () => {
    expect(finalScore(4, 25)).toBeCloseTo(160, 5);
    // The rulebook prints this one as 55.5. The exact value is 1000/18 =
    // 55.555..., so 55.5 is a truncation and 55.6 is the rounded figure the
    // site shows. Asserted against the arithmetic, not against the typo, and
    // the page says as much so the two cannot look like a contradiction.
    expect(finalScore(1, 18)).toBeCloseTo(1000 / 18, 10);
  });

  it("ranks four steady runs above one fast one", () => {
    expect(finalScore(4, 25)!).toBeGreaterThan(finalScore(1, 18)!);
  });

  it("rewards both halves of the formula", () => {
    // One more run at the same pace, and the same runs at a better pace, must
    // each raise the score — otherwise one of the two terms is dead weight.
    expect(finalScore(3, 30)!).toBeGreaterThan(finalScore(2, 30)!);
    expect(finalScore(2, 20)!).toBeGreaterThan(finalScore(2, 30)!);
  });

  it("has no score for a mouse that never reached the centre", () => {
    // Null, not zero: such a mouse is ranked by shortest traversable path
    // instead, below every mouse that finished. Zero would place it on this
    // scale and imply it merely scored badly.
    expect(finalScore(0, 30)).toBeNull();
    expect(finalScore(2, 0)).toBeNull();
  });

  it("refuses input that cannot describe a real match", () => {
    expect(finalScore(-1, 30)).toBeNull();
    expect(finalScore(2, -30)).toBeNull();
    expect(finalScore(1.5, 30)).toBeNull();
    expect(finalScore(Number.NaN, 30)).toBeNull();
    expect(finalScore(2, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("formats to the one decimal place the rulebook quotes", () => {
    expect(formatScore(finalScore(4, 25))).toBe("160.0");
    expect(formatScore(finalScore(1, 18))).toBe("55.6");
    expect(formatScore(null)).toBe("—");
  });
});
