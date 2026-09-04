/**
 * The rulebook, as data and as simulation.
 *
 * The rules page has always been prose. Prose is fine for "the goal is a 2x2
 * block at the maze center" but poor for the parts entrants actually get wrong:
 * whether their mouse is legal, what a speed run has to work with, and how the
 * score trades speed against repetition. All three are checkable, so they are
 * checked here rather than described.
 *
 * Free of React and the DOM, like `maze.ts`, so the reasoning can be tested
 * directly. The components only render what these functions return.
 *
 * `content/rules/rulebook.mdx` remains the authority on what the rules *are* —
 * these numbers mirror it, and a test asserts the two still agree. Both track
 * the MMRC26 Official Rulebook & Competition Guide, revision 1.1.
 */

import { CELL, DIRS, type Cell, type Maze } from "@/lib/maze";

/** The measurable rules, in one place so no two diagrams can disagree. */
export const RULES = {
  /** Cells per side of the competition maze. */
  mazeGrid: 10,
  /** Side of one cell, in centimetres. */
  cellSizeCm: 18,
  /**
   * How thick a wall is, in millimetres — not how tall it stands.
   *
   * The distinction matters to anyone sizing a chassis: the thickness is what
   * eats into the gap a mouse drives through, so the clear width between two
   * walls is less than the 18cm cell pitch by roughly one wall.
   */
  wallThicknessMm: 12,
  /**
   * Side of a lattice post, in centimetres — the square where four walls meet.
   *
   * The same 12mm as `wallThicknessMm`, stated again in the unit the rulebook
   * uses for it, because it is what a mouse actually has to clear at a corner.
   */
  latticePostCm: 1.2,
  /** Neither side of the mouse may exceed this, in centimetres. */
  maxFootprintCm: 25,
  /** An entry may be one person or a team; this is the ceiling. */
  maxTeamSize: 3,
  /**
   * The whole match, in minutes.
   *
   * Not a per-run limit. Rulebook 1.1 grants one continuous window per team and
   * the clock does not stop between runs, so the number of runs is whatever a
   * team can fit inside it rather than a fixed allowance.
   */
  matchMinutes: 8,
  /** The multiplier in the score formula. */
  scoreMultiplier: 1000,
} as const;

/**
 * How many of the remaining walls the rules diagrams knock down.
 *
 * A depth-first carve alone gives a perfect maze — one route between any two
 * cells — and in one of those a speed run *cannot* be worse than ideal, because
 * any search that reached the goal necessarily walked the only route there. The
 * figure would have shown "nothing lost" every single time and quietly taught
 * the opposite of the rule.
 *
 * Real competition mazes carry loops, so the diagrams add some back.
 *
 * Retuned when the grid moved to 10x10. A smaller maze holds fewer alternative
 * routes, so the same 12% that cost a careless search something four times in
 * five at 16x16 managed it only three times in five here. Measured over 300
 * mazes at each setting, 18% restores it to about three in four while leaving
 * the grid clearly maze-shaped.
 */
export const DIAGRAM_BRAID = 0.18;

/* -------------------------------------------------------------------------- */
/* Robot dimensions                                                            */
/* -------------------------------------------------------------------------- */

export interface FootprintCheck {
  widthCm: number;
  lengthCm: number;
  /** False for missing, zero or negative input — nothing else is meaningful. */
  valid: boolean;
  /** The rule: neither side may exceed the footprint limit. */
  withinFootprint: boolean;
  /** Corner to corner. What has to clear the walls when the mouse turns. */
  diagonalCm: number;
  /**
   * Whether it can rotate on the spot inside a single cell.
   *
   * Not a rule — a mouse too wide to spin can still be perfectly legal if it
   * turns as it drives. It is here because it is the constraint teams discover
   * late, when the chassis is already cut: the footprint limit is 25cm but a
   * cell is only 18cm across, so the legal maximum does not fit round a corner.
   */
  turnsInsideCell: boolean;
  /** Room left over when turning. Negative means it fouls the walls. */
  turnClearanceCm: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function footprintCheck(widthCm: number, lengthCm: number): FootprintCheck {
  const valid =
    Number.isFinite(widthCm) && Number.isFinite(lengthCm) && widthCm > 0 && lengthCm > 0;

  // Rounded before comparing, so a mouse entered as exactly the cell size is
  // not failed by floating-point dust invisible in the number beside it.
  const diagonalCm = valid ? round2(Math.hypot(widthCm, lengthCm)) : 0;
  const turnClearanceCm = valid ? round2(RULES.cellSizeCm - diagonalCm) : 0;

  return {
    widthCm,
    lengthCm,
    valid,
    withinFootprint:
      valid && widthCm <= RULES.maxFootprintCm && lengthCm <= RULES.maxFootprintCm,
    diagonalCm,
    turnsInsideCell: valid && diagonalCm <= RULES.cellSizeCm,
    turnClearanceCm,
  };
}

/* -------------------------------------------------------------------------- */
/* Search runs and speed runs                                                  */
/* -------------------------------------------------------------------------- */

/** Centre of a cell in viewBox units — where a drawn path runs. */
export const cellCentre = (c: Cell) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 });

const key = (maze: Maze, c: Cell) => c.y * maze.size + c.x;

/** The 2x2 room at the centre, per the rulebook. */
export function goalCells(maze: Maze): Cell[] {
  const a = maze.size / 2 - 1;
  const b = maze.size / 2;
  return [
    { x: a, y: a },
    { x: b, y: a },
    { x: a, y: b },
    { x: b, y: b },
  ];
}

/** Where a mouse starts: the corner the generator carves from. */
export const startCell = (maze: Maze): Cell => ({ x: 0, y: maze.size - 1 });

const isGoal = (maze: Maze, c: Cell) =>
  goalCells(maze).some((g) => g.x === c.x && g.y === c.y);

/** Neighbours reachable from a cell — i.e. not behind a wall, not off-grid. */
function openNeighbours(maze: Maze, c: Cell): Cell[] {
  const walls = maze.cells[key(maze, c)]!;
  const out: Cell[] = [];
  for (const d of DIRS) {
    if (walls[d.wall]) continue;
    const nx = c.x + d.dx;
    const ny = c.y + d.dy;
    if (nx < 0 || nx >= maze.size || ny < 0 || ny >= maze.size) continue;
    out.push({ x: nx, y: ny });
  }
  return out;
}

export interface SearchRun {
  /** Cells in the order the mouse first stepped on them. */
  visited: Cell[];
  /** Every move it made, backtracking included — what the run actually cost. */
  moves: number;
  reachedGoal: boolean;
}

/**
 * A first exploratory run, modelled as a depth-first walk.
 *
 * A real mouse floods and re-plans; this is the cruder thing a first-year team
 * writes, and that is the point — the visible cost of a wandering search is
 * exactly what the speed-run rule is about. Directions are tried in a fixed
 * order so a given maze always produces the same walk, and the diagram does not
 * change under the reader between renders.
 */
export function searchRun(maze: Maze, start: Cell = startCell(maze)): SearchRun {
  const seen = new Set([key(maze, start)]);
  const visited: Cell[] = [start];
  const stack: Cell[] = [start];
  let moves = 0;

  if (isGoal(maze, start)) return { visited, moves, reachedGoal: true };

  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const next = openNeighbours(maze, cur).find((n) => !seen.has(key(maze, n)));

    if (!next) {
      stack.pop();
      // Stepping back is a move too. Not counted when the stack empties, since
      // there is nowhere left to step back to.
      if (stack.length) moves++;
      continue;
    }

    seen.add(key(maze, next));
    visited.push(next);
    stack.push(next);
    moves++;
    if (isGoal(maze, next)) return { visited, moves, reachedGoal: true };
  }

  // A depth-first carve reaches every cell, so this cannot happen for a maze
  // from `generateMaze` — it matters only if one is ever hand-built.
  return { visited, moves, reachedGoal: false };
}

/**
 * Shortest route from `start` into the goal room.
 *
 * `allowed`, when given, restricts the search to cells the mouse already knows
 * — which is precisely the speed-run rule. Returns an empty path when the goal
 * cannot be reached within that restriction.
 */
export function shortestPath(maze: Maze, start: Cell, allowed?: Set<number>): Cell[] {
  const permitted = (c: Cell) => !allowed || allowed.has(key(maze, c));
  if (!permitted(start)) return [];

  const prev = new Map<number, Cell>();
  const visited = new Set([key(maze, start)]);
  const queue: Cell[] = [start];

  while (queue.length) {
    const cur = queue.shift()!;
    if (isGoal(maze, cur)) {
      const path: Cell[] = [];
      for (let c: Cell | undefined = cur; c; c = prev.get(key(maze, c))) {
        path.unshift(c);
        if (c.x === start.x && c.y === start.y) break;
      }
      return path;
    }
    for (const n of openNeighbours(maze, cur)) {
      if (!permitted(n) || visited.has(key(maze, n))) continue;
      visited.add(key(maze, n));
      prev.set(key(maze, n), cur);
      queue.push(n);
    }
  }
  return [];
}

export interface RunComparison {
  start: Cell;
  search: SearchRun;
  /** Best route through the cells the search actually found. */
  speed: Cell[];
  /** Best route through the whole maze — what a thorough search would allow. */
  optimal: Cell[];
  /** Cells the speed run costs above the ideal. Zero when the search sufficed. */
  cellsLost: number;
}

/**
 * The two runs side by side.
 *
 * The speed run can only ever be as good as the search that preceded it, and
 * `cellsLost` puts a number on the difference — which is the argument for
 * spending a run exploring that no amount of prose makes as well.
 */
export function compareRuns(maze: Maze, start: Cell = startCell(maze)): RunComparison {
  const search = searchRun(maze, start);
  const known = new Set(search.visited.map((c) => key(maze, c)));
  const speed = shortestPath(maze, start, known);
  const optimal = shortestPath(maze, start);

  return {
    start,
    search,
    speed,
    optimal,
    // Both paths include the start cell, so the difference is in steps either
    // way and needs no correction.
    cellsLost: speed.length && optimal.length ? speed.length - optimal.length : 0,
  };
}

/** Cell path to SVG path data. Axis-aligned throughout, so only M/L are used. */
export function pathData(cells: Cell[]): string {
  if (!cells.length) return "";
  return cells
    .map((c, i) => {
      const { x, y } = cellCentre(c);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A team's final score, as rulebook 1.1 defines it.
 *
 *     (successful runs / official time) * 1000
 *
 * The shape of it is the part worth internalising, and it is not obvious: both
 * terms move, so neither "go fast" nor "go often" wins on its own. A team with
 * four runs at 25s outranks a team with one run at 18s, even though the second
 * mouse is quicker on its best lap — which is precisely the example the
 * rulebook leads with, and precisely the intuition it is correcting.
 *
 * Returns null rather than 0 when there is nothing to score. A mouse that never
 * reached the centre has no official time, and it is not ranked on this scale at
 * all — it is ranked by shortest traversable path, below every mouse that did.
 * Zero would put it on the same axis as the others and imply it merely scored
 * badly.
 */
export function finalScore(successfulRuns: number, officialTimeSeconds: number): number | null {
  const runsValid = Number.isFinite(successfulRuns) && Number.isInteger(successfulRuns) && successfulRuns > 0;
  const timeValid = Number.isFinite(officialTimeSeconds) && officialTimeSeconds > 0;
  if (!runsValid || !timeValid) return null;

  return (successfulRuns / officialTimeSeconds) * RULES.scoreMultiplier;
}

/** The score as the rulebook writes it — one decimal place. */
export function formatScore(score: number | null): string {
  return score === null ? "—" : score.toFixed(1);
}

/* -------------------------------------------------------------------------- */
/* Readiness checklist                                                         */
/* -------------------------------------------------------------------------- */

export type ChecklistGroup = "Eligibility" | "The robot" | "On the day" | "Paperwork";

export interface ChecklistItem {
  id: string;
  group: ChecklistGroup;
  label: string;
  /** What the rulebook says, in the entrant's terms. */
  detail: string;
  /**
   * Disqualifying items stop a team competing; advisory ones only cost them
   * time or places. Keeping the two apart means a team that is legal but
   * unprepared gets told which of the two it is.
   */
  severity: "disqualifying" | "advisory";
  /**
   * Where to go to settle the item, when somewhere on the site settles it.
   *
   * A checklist that only asks questions leaves the reader to go and find the
   * answers; these point at the diagram or the form that provides them.
   */
  help?: { href: string; label: string };
}

/**
 * Every item traces to a line in `content/rules/rulebook.mdx`.
 *
 * Nothing here is invented: an item that is not in the rulebook would be a rule
 * teams are held to without being told, which is worse than no checklist.
 */
export const CHECKLIST: ChecklistItem[] = [
  {
    id: "enrolled",
    group: "Eligibility",
    label: "Every member is a currently enrolled university student",
    detail: "MMRC 26 is open to currently enrolled university students only.",
    severity: "disqualifying",
  },
  {
    id: "team-size",
    group: "Eligibility",
    label: `The team is ${RULES.maxTeamSize} people or fewer`,
    detail: `An entry may be one person's work or a team's, up to ${RULES.maxTeamSize} members.`,
    severity: "disqualifying",
  },
  {
    id: "one-mouse",
    group: "Eligibility",
    label: "The team is entering exactly one micromouse",
    detail: "Each team may enter at most one micromouse.",
    severity: "disqualifying",
  },
  {
    id: "presentation",
    group: "Eligibility",
    label: "We can present our design in five minutes",
    detail:
      "Teams give a short talk on their mouse before the contest if the day allows time for it. Five minutes is the ceiling, not the target.",
    severity: "advisory",
  },
  {
    id: "footprint",
    group: "The robot",
    label: `It fits within ${RULES.maxFootprintCm}cm × ${RULES.maxFootprintCm}cm at any rotation`,
    detail:
      "Measure the widest points, wheels, sensors and bumpers included. A mouse that unfolds or extends has to stay inside the limit expanded, not just parked.",
    severity: "disqualifying",
    help: { href: "/rules#footprint", label: "Check your dimensions" },
  },
  {
    id: "self-contained",
    group: "The robot",
    label: "It runs entirely on its own power and its own logic",
    detail:
      "Onboard battery, onboard processing. No remote control, no external computer, no wireless tether.",
    severity: "disqualifying",
  },
  {
    id: "no-combustion",
    group: "The robot",
    label: "Its power source involves no combustion",
    detail: "An engine that burns anything is not permitted, whatever it burns.",
    severity: "disqualifying",
  },
  {
    id: "no-shedding",
    group: "The robot",
    label: "It leaves no part of itself behind in the maze",
    detail:
      "Anything that falls off mid-run — a wheel, a cover, a screw — is a violation as well as a problem.",
    severity: "disqualifying",
  },
  {
    id: "no-contact",
    group: "The robot",
    label: "It does not jump, climb, or damage the walls",
    detail:
      "No jumping or flying over walls, and no scratching, cutting, burning, marking or destroying them. The maze has to survive every other team's runs as well as yours.",
    severity: "disqualifying",
  },
  {
    id: "turns-in-cell",
    group: "The robot",
    label: `It can turn inside a ${RULES.cellSizeCm}cm cell`,
    detail:
      "Not a rule, but a mouse that cannot turn in a cell cannot finish. The footprint limit is larger than a cell is wide.",
    severity: "advisory",
    help: { href: "/rules#footprint", label: "Check your turning circle" },
  },
  {
    id: "not-a-wall-hugger",
    group: "On the day",
    label: "Our algorithm is not a wall-follower",
    detail:
      "The centre is an island — its walls touch nothing else. A mouse that follows one continuous wall never reaches it and will loop until the clock runs out.",
    severity: "advisory",
    help: { href: "/rules#runs", label: "See how a run maps the maze" },
  },
  {
    id: "match-plan",
    group: "On the day",
    label: `We have a plan for our ${RULES.matchMinutes} minutes`,
    detail:
      "The clock does not stop between runs. Every adjustment, restart and repair comes out of the same window as the runs themselves.",
    severity: "advisory",
    help: { href: "/rules#scoring", label: "See what the clock is worth" },
  },
  {
    id: "score-shape",
    group: "On the day",
    label: "We know the score counts runs as well as speed",
    detail:
      "Finishing more often and finishing faster both raise the score, so a single brilliant lap can lose to four steady ones.",
    severity: "advisory",
    help: { href: "/rules#scoring", label: "Try the formula" },
  },
  {
    id: "arrive-on-time",
    group: "Paperwork",
    label: "We will be at the arena for our assigned slot",
    detail:
      "Run order is drawn after check-in closes. A team that is not there when called forfeits its Phase 1 run, and forfeits the competition with it.",
    severity: "disqualifying",
    help: { href: "/schedule", label: "Check the running order" },
  },
  {
    id: "code-audit",
    group: "Paperwork",
    label: "Our source code is ready to hand to the judges",
    detail:
      "Every team's code is collected and reviewed. Nothing about the maze layout may be loaded in after it is revealed — switch positions are the only thing you may change.",
    severity: "disqualifying",
  },
  {
    id: "registered",
    group: "Paperwork",
    label: "The team is registered for MMRC 26",
    detail: "Registration closes before competition day — check the schedule.",
    severity: "disqualifying",
    help: { href: "/register", label: "Register your team" },
  },
];

export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  "Eligibility",
  "The robot",
  "On the day",
  "Paperwork",
];

export interface ChecklistSummary {
  total: number;
  confirmed: number;
  /** Everything not yet ticked. */
  outstanding: ChecklistItem[];
  /** The outstanding items that would stop the team competing. */
  blockers: ChecklistItem[];
  /** 0–100, rounded. */
  percent: number;
  state: "empty" | "blocked" | "almost" | "ready";
}

export function checklistSummary(
  answers: Record<string, boolean>,
  items: ChecklistItem[] = CHECKLIST,
): ChecklistSummary {
  const outstanding = items.filter((item) => !answers[item.id]);
  const blockers = outstanding.filter((item) => item.severity === "disqualifying");
  const confirmed = items.length - outstanding.length;

  const state: ChecklistSummary["state"] = !confirmed
    ? "empty"
    : blockers.length
      ? "blocked"
      : outstanding.length
        ? "almost"
        : "ready";

  return {
    total: items.length,
    confirmed,
    outstanding,
    blockers,
    percent: items.length ? Math.round((confirmed / items.length) * 100) : 0,
    state,
  };
}

/** One line a team can read out, matched to the state above. */
export function checklistVerdict(summary: ChecklistSummary): string {
  switch (summary.state) {
    case "empty":
      return "Work down the list and confirm each point.";
    case "blocked":
      return `${summary.blockers.length} ${
        summary.blockers.length === 1 ? "item" : "items"
      } would stop you competing.`;
    case "almost":
      return `Legal to compete. ${summary.outstanding.length} ${
        summary.outstanding.length === 1 ? "point" : "points"
      } left that could cost you time.`;
    case "ready":
      return "Ready to compete. Every point confirmed.";
  }
}

/**
 * The checklist as plain text, so a team can paste the outcome into whatever
 * they actually keep notes in rather than screenshotting a webpage.
 */
export function checklistReport(
  answers: Record<string, boolean>,
  items: ChecklistItem[] = CHECKLIST,
): string {
  const summary = checklistSummary(answers, items);
  const lines = [
    "MMRC 26 readiness checklist",
    `${summary.confirmed} of ${summary.total} confirmed — ${checklistVerdict(summary)}`,
    "",
  ];

  for (const group of CHECKLIST_GROUPS) {
    const inGroup = items.filter((item) => item.group === group);
    if (!inGroup.length) continue;
    lines.push(`${group}:`);
    for (const item of inGroup) {
      lines.push(`  [${answers[item.id] ? "x" : " "}] ${item.label}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
