import { DIRS, type Cell, type Maze } from "@/lib/maze";
import { RULES, finalScore, goalCells, isGoal, openNeighbours, startCell } from "@/lib/rules";

/**
 * The build guide, as arithmetic.
 *
 * Everything a team argues about before it starts cutting acrylic is either a
 * measurement or a consequence of the score formula, and both are checkable.
 * So the guide states them once, here, and the page draws what these functions
 * return rather than repeating numbers in prose that nobody re-derives when the
 * rulebook moves.
 *
 * `content/rules/rulebook.mdx` and `@/lib/rules` stay the authority on what the
 * rules are. Nothing in this file invents a rule; it works out what the rules
 * cost a robot.
 */

/* ------------------------------------------------------------------ the gap */

/**
 * The 18cm question, and why this file carries two answers to it.
 *
 * The rulebook says the maze is built to IEEE micromouse dimensions, and also
 * that a cell measures 18cm between the inside faces of its walls. Those are
 * not the same statement. IEEE measures 180mm from wall centre to wall centre,
 * which leaves 168mm of clear road once a 12mm wall is taken out; read the
 * rulebook's sentence literally and the road is the full 180mm and the pitch
 * is 192mm.
 *
 * A guide has no business picking a side of that quietly, and a team has no
 * business betting a chassis on it. Both numbers are here, and everything that
 * advises a builder uses the smaller one: a mouse that fits the tight reading
 * fits either maze, and a mouse sized for the generous one might not fit at
 * all.
 */
export const GEOMETRY = {
  /** The rulebook's own sentence: 18cm between the inside faces. */
  statedClearMm: RULES.cellSizeCm * 10,
  /** The same 18cm read as IEEE reads it: centre to centre. */
  ieeePitchMm: RULES.cellSizeCm * 10,
  wallThicknessMm: RULES.wallThicknessMm,
  postMm: RULES.latticePostCm * 10,
  /** The rulebook's 5%, which cuts both ways and is only dangerous one way. */
  tolerance: 0.05,
} as const;

/** Clear road under the cautious reading: the pitch, less one wall. */
export const TIGHT_CLEAR_MM = GEOMETRY.ieeePitchMm - GEOMETRY.wallThicknessMm;

/** The same, after the tolerance has gone against you. Design to this. */
export function narrowestGapMm(): number {
  return round(TIGHT_CLEAR_MM * (1 - GEOMETRY.tolerance));
}

export interface Clearance {
  /** Millimetres between the mouse and each wall, in the worst legal cell. */
  eachSideMm: number;
  /** Whether it fits at all. */
  fits: boolean;
  /** Whether it can turn on the spot without clipping a wall. */
  spins: boolean;
  /** Plain words for the number, since the number alone teaches nothing. */
  verdict: string;
}

/**
 * What a footprint has left over in the tightest corridor the rules allow.
 *
 * Note what this is not: the 25cm rule. That is the legality check, and it
 * lives in `footprintCheck` with the rest of the rulebook. A mouse can pass
 * that and still be undrivable, because 25cm of robot does not go through
 * 16cm of gap. Both answers matter and they are different questions.
 *
 * Spinning is judged on the diagonal, because a mouse turning about its own
 * centre sweeps a circle the width of its longest corner-to-corner line. Plenty
 * of first builds fit down a corridor and then jam solid on their first turn.
 */
export function clearance(widthMm: number, lengthMm: number): Clearance {
  const gap = narrowestGapMm();
  const eachSideMm = round((gap - widthMm) / 2);
  const diagonal = Math.sqrt(widthMm * widthMm + lengthMm * lengthMm);
  const fits = widthMm < gap;
  const spins = diagonal < gap;

  return {
    eachSideMm,
    fits,
    spins,
    verdict: !fits
      ? "Too wide for the gap. It will not get down a corridor at all."
      : !spins
        ? "It fits a corridor but cannot turn on the spot. It needs room ahead of it to turn, or a shorter body."
        : eachSideMm < 15
          ? "It fits, but there is very little either side. Sensor noise or a slipped wheel will have it touching a wall."
          : eachSideMm > 45
            ? "Comfortable. Plenty of room to correct in, though a narrow mouse is also a light one."
            : "A sensible fit: room to correct in without wasting the cell.",
  };
}

/* ------------------------------------------------------------- flood fill */

/** Unreachable, for cells the walls shut off entirely. */
export const UNREACHABLE = Infinity;

/**
 * Every cell's distance from the goal, in cells.
 *
 * This is the whole of flood fill, and it is worth seeing how little it is: a
 * breadth-first sweep outward from the centre that never crosses a wall. The
 * mouse then drives downhill. Nothing about it searches, backtracks or
 * remembers a route, which is exactly why it survives a map that changes under
 * it: re-flood and drive downhill again.
 *
 * Distances are in cells rather than centimetres on purpose. A mouse that has
 * never seen the maze knows how many cells it has crossed and nothing more
 * precise than that.
 */
export function floodFill(maze: Maze, targets: Cell[] = goalCells(maze)): number[][] {
  const distances = Array.from({ length: maze.size }, () =>
    Array.from({ length: maze.size }, () => UNREACHABLE),
  );

  const queue: Cell[] = [];
  for (const cell of targets) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= maze.size || cell.y >= maze.size) continue;
    distances[cell.y]![cell.x] = 0;
    queue.push(cell);
  }

  // A plain queue, not a priority queue. Every step costs one, so the first
  // time a cell is reached is the cheapest time it can be reached.
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const next = distances[cell.y]![cell.x]! + 1;
    for (const neighbour of openNeighbours(maze, cell)) {
      if (distances[neighbour.y]![neighbour.x]! <= next) continue;
      distances[neighbour.y]![neighbour.x] = next;
      queue.push(neighbour);
    }
  }

  return distances;
}

/**
 * The route a flooded mouse drives: downhill, one cell at a time.
 *
 * Ties are broken by staying on the current heading where that is downhill.
 * Turning costs real seconds that this arithmetic cannot see, and of two routes
 * the same length the straighter one is always the faster to drive.
 */
export function floodRoute(
  maze: Maze,
  distances: number[][],
  from: Cell = startCell(maze),
): Cell[] {
  const route: Cell[] = [from];
  let cell = from;
  let heading: { dx: number; dy: number } | null = null;

  // Bounded by the number of cells: distances strictly decrease, so this cannot
  // loop, but a malformed grid should not be able to hang a browser either.
  for (let step = 0; step < maze.size * maze.size; step++) {
    const here = distances[cell.y]![cell.x]!;
    if (here === 0) return route;
    if (!Number.isFinite(here)) return route;

    let best: Cell | null = null;
    let bestStraight = false;
    for (const neighbour of openNeighbours(maze, cell)) {
      if (distances[neighbour.y]![neighbour.x]! !== here - 1) continue;
      const straight =
        heading !== null && neighbour.x - cell.x === heading.dx && neighbour.y - cell.y === heading.dy;
      if (!best || (straight && !bestStraight)) {
        best = neighbour;
        bestStraight = straight;
      }
    }

    if (!best) return route;
    heading = { dx: best.x - cell.x, dy: best.y - cell.y };
    cell = best;
    route.push(cell);
  }

  return route;
}

/** How many times a route changes direction. Turns are what speed runs pay for. */
export function countTurns(route: Cell[]): number {
  let turns = 0;
  for (let i = 2; i < route.length; i++) {
    const a = route[i - 2]!;
    const b = route[i - 1]!;
    const c = route[i]!;
    if ((b.x - a.x) !== (c.x - b.x) || (b.y - a.y) !== (c.y - b.y)) turns++;
  }
  return turns;
}

/* --------------------------------------------------------- the wall hugger */

export interface WallFollow {
  /** Every cell stepped on, in order, including repeats. */
  path: Cell[];
  reachedGoal: boolean;
  /** True once it is provably going round in circles. */
  looped: boolean;
  steps: number;
}

/**
 * The oldest maze algorithm there is, run against this competition's maze.
 *
 * Keep one hand on a wall and walk: in a maze whose walls all connect, that
 * reaches every room eventually. The MMRC26 centre is an island, so its walls
 * connect to nothing, and a hand on the outer wall traces the outer wall until
 * the eight minutes are gone.
 *
 * It is here to be watched failing. Told in a sentence it sounds like a corner
 * case; watched, it is obviously the whole outcome of somebody's competition.
 */
export function wallFollow(
  maze: Maze,
  hand: "left" | "right" = "left",
  maxSteps = 400,
): WallFollow {
  const start = startCell(maze);
  const path: Cell[] = [start];
  let cell = start;
  // Facing north, the way a mouse leaves a corner with walls on three sides.
  let heading = 0;
  const seen = new Set<string>();

  for (let step = 0; step < maxSteps; step++) {
    if (isGoal(maze, cell)) return { path, reachedGoal: true, looped: false, steps: step };

    // The hand order: the hand's side first, then straight on, then the other
    // side, then back the way it came.
    const turn = hand === "left" ? [3, 0, 1, 2] : [1, 0, 3, 2];
    let moved = false;
    for (const offset of turn) {
      const dir = (heading + offset) % 4;
      const d = DIRS[dir]!;
      if (maze.cells[cell.y * maze.size + cell.x]![d.wall]) continue;
      const nx = cell.x + d.dx;
      const ny = cell.y + d.dy;
      if (nx < 0 || ny < 0 || nx >= maze.size || ny >= maze.size) continue;
      heading = dir;
      cell = { x: nx, y: ny };
      path.push(cell);
      moved = true;
      break;
    }

    if (!moved) break;

    // Same cell, same heading, twice: from here on it repeats exactly.
    const state = `${cell.x},${cell.y},${heading}`;
    if (seen.has(state)) {
      return { path, reachedGoal: false, looped: true, steps: step + 1 };
    }
    seen.add(state);
  }

  return { path, reachedGoal: isGoal(maze, cell), looped: false, steps: path.length - 1 };
}

/* ------------------------------------------------------------ the 8 minutes */

/** The whole match, in seconds. The clock does not stop between runs. */
export const MATCH_SECONDS = RULES.matchMinutes * 60;

export interface MatchPlan {
  /** Runs that reached the centre, which is what the formula counts. */
  runs: number;
  /** The fastest of them, which is the official time. */
  officialSeconds: number;
  score: number | null;
  usedSeconds: number;
  spareSeconds: number;
  /** True when the plan does not even fit one search run. */
  overruns: boolean;
}

export interface MatchInput {
  /** The first run, mapping as it goes. */
  searchSeconds: number;
  /** Each later run, driving the route it learned. */
  speedSeconds: number;
  /** Carrying it back and restarting it. Part of the eight minutes. */
  resetSeconds: number;
  /** Anything left on the clock you do not intend to use. */
  matchSeconds?: number;
}

/**
 * What an eight minute match is actually worth, given how you spend it.
 *
 * The formula is the rulebook's: successful runs divided by the fastest one,
 * times a thousand. Two things follow from it that are not obvious until the
 * arithmetic is in front of you, and both are in this function rather than in
 * a paragraph nobody checks.
 *
 * The first is that a search run that reaches the centre counts. It is slow and
 * it drags nothing down, because only the fastest run sets the official time.
 *
 * The second is that the reset between runs is charged at the same rate as the
 * runs. A team that takes twenty seconds to carry its mouse back and restart it
 * has spent, over six runs, longer resetting than driving.
 */
export function planMatch({
  searchSeconds,
  speedSeconds,
  resetSeconds,
  matchSeconds = MATCH_SECONDS,
}: MatchInput): MatchPlan {
  const search = Math.max(0, searchSeconds);
  const speed = Math.max(0, speedSeconds);
  const reset = Math.max(0, resetSeconds);

  if (search + reset > matchSeconds) {
    return {
      runs: 0,
      officialSeconds: 0,
      score: null,
      usedSeconds: 0,
      spareSeconds: matchSeconds,
      overruns: true,
    };
  }

  let used = search + reset;
  let runs = 1;
  const perRun = speed + reset;

  // A run only counts once it has finished, so a run that would not fit inside
  // the clock is not started.
  while (perRun > 0 && used + perRun <= matchSeconds) {
    used += perRun;
    runs++;
  }

  const officialSeconds = runs > 1 ? Math.min(search, speed) : search;

  return {
    runs,
    officialSeconds,
    score: finalScore(runs, officialSeconds),
    usedSeconds: round(used),
    spareSeconds: round(matchSeconds - used),
    overruns: false,
  };
}

/**
 * The lesson the formula teaches, as two plans side by side.
 *
 * The comparison is the point of the whole strategy section: one flawless run
 * is worth less than several ordinary ones, and by a margin that surprises
 * people who have only ever watched the fast mice on video.
 */
export function strategySpread(input: MatchInput): { careful: MatchPlan; repeated: MatchPlan } {
  return {
    // One search, one speed run, then stop and hope.
    careful: planMatch({ ...input, matchSeconds: input.searchSeconds + input.resetSeconds * 2 + input.speedSeconds }),
    repeated: planMatch(input),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A maze whose centre is an island, like the competition maze.
 *
 * Needed because the site's generator does not guarantee one. It carves a goal
 * room with a single door, which is most of the rulebook's description, but
 * whether that room's walls end up touching the rest of the maze is left to
 * chance: in a perfect maze every wall is joined to every other, so a hand on
 * the outer wall is eventually led inside. Braiding breaks those joins, and at
 * the diagram setting about half of the mazes come out as true islands.
 *
 * So the guide picks one rather than trusting one. Anything demonstrating the
 * rulebook's warning has to be demonstrating it on a maze the warning is true
 * of, or it teaches the opposite of what it says.
 */
export function islandMaze(
  generate: () => Maze,
  attempts = 12,
): { maze: Maze; isIsland: boolean } {
  let fallback = generate();

  for (let i = 0; i < attempts; i++) {
    const candidate = i === 0 ? fallback : generate();
    const left = wallFollow(candidate, "left", 800);
    const right = wallFollow(candidate, "right", 800);
    if (!left.reachedGoal && !right.reachedGoal) return { maze: candidate, isIsland: true };
    fallback = candidate;
  }

  // Better a maze that makes the point weakly than a browser stuck generating
  // mazes. The caller is told which it got.
  return { maze: fallback, isIsland: false };
}

/* ------------------------------------------------------------ editing walls */

export interface WallSegment {
  /** Endpoints in viewBox units, ready to draw. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cell: Cell;
  /** Index into DIRS, and into the cell's wall array. */
  dir: number;
  /** Whether a wall actually stands here. */
  present: boolean;
  /** False for the outer boundary, which is not a reader's to knock down. */
  editable: boolean;
}

/**
 * Every edge in the maze as a drawable, clickable segment.
 *
 * The maze carries its walls twice: `cells` is the grid a mouse walks, and
 * `walls` is the same information merged into long paths for drawing. Merged
 * paths are lovely to render and impossible to edit, so anything that lets a
 * reader knock a wall down has to draw from the grid instead.
 *
 * Empty edges are reported too, with `present` false. A maze you can only
 * subtract from is half an editor, and the gap you want to close is usually
 * the one that makes the point.
 *
 * Each edge is emitted once rather than twice, by only ever reporting a cell's
 * north and west sides plus the outer edges. Otherwise every internal wall
 * would be drawn twice and clicking one would toggle it straight back.
 */
export function wallSegments(maze: Maze, unit: number): WallSegment[] {
  const out: WallSegment[] = [];

  for (let y = 0; y < maze.size; y++) {
    for (let x = 0; x < maze.size; x++) {
      const walls = maze.cells[y * maze.size + x]!;
      const left = x * unit;
      const top = y * unit;

      out.push({
        x1: left, y1: top, x2: left + unit, y2: top,
        cell: { x, y }, dir: 0, present: walls[0], editable: y > 0,
      });
      out.push({
        x1: left, y1: top, x2: left, y2: top + unit,
        cell: { x, y }, dir: 3, present: walls[3], editable: x > 0,
      });

      // The far two edges of the grid, which no other cell will report.
      if (y === maze.size - 1) {
        out.push({
          x1: left, y1: top + unit, x2: left + unit, y2: top + unit,
          cell: { x, y }, dir: 2, present: walls[2], editable: false,
        });
      }
      if (x === maze.size - 1) {
        out.push({
          x1: left + unit, y1: top, x2: left + unit, y2: top + unit,
          cell: { x, y }, dir: 1, present: walls[1], editable: false,
        });
      }
    }
  }

  return out;
}

/**
 * The same maze with one wall flipped, on both sides of it.
 *
 * A wall belongs to two cells and the grid stores it twice. Flip one copy and
 * the mouse can drive through it in one direction and not the other, which is
 * a bug that looks exactly like a pathfinding bug and is not one.
 *
 * Returns a new maze. The old one is still referenced by whatever is animating
 * over it, and mutating underneath an animation is how a route ends up drawn
 * through a wall that has just appeared.
 */
export function toggleWall(maze: Maze, cell: Cell, dir: number): Maze {
  const d = DIRS[dir];
  if (!d) return maze;

  const nx = cell.x + d.dx;
  const ny = cell.y + d.dy;
  // The outer boundary stays up. A maze you can drive out of is not a maze.
  if (nx < 0 || ny < 0 || nx >= maze.size || ny >= maze.size) return maze;

  const cells = maze.cells.map((walls) => [...walls] as typeof walls);
  const here = cells[cell.y * maze.size + cell.x]!;
  const there = cells[ny * maze.size + nx]!;
  const next = !here[d.wall];
  here[d.wall] = next;
  there[d.opp] = next;

  return { ...maze, cells };
}
