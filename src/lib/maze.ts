/**
 * Micromouse maze generation, solving and pacing.
 *
 * Deliberately free of React and of any DOM access, so the part that has to be
 * *correct* — that a drawn route never crosses a wall — can be tested on its
 * own, at volume, without a browser. The component only turns this data into
 * SVG.
 *
 * What it follows from the competition rules: a square grid, mice starting in
 * the corners, and a goal that is the 2x2 block at the centre with its interior
 * walls removed.
 *
 * A fresh maze is drawn on every visit rather than baked at build time, so no
 * two visitors see the same one. Generation is well under a millisecond at
 * these sizes, which is what makes that affordable on the client.
 */

/** Walls of a single cell, in [N, E, S, W] order. `true` means present. */
export type CellWalls = [boolean, boolean, boolean, boolean];

export interface Cell {
  x: number;
  y: number;
}

export interface Route {
  /** Centre of the starting cell, in viewBox units. */
  start: Cell;
  cells: number;
  turns: number;
  /** Total travel in viewBox units — what the pacing is derived from. */
  pathLength: number;
  /** SVG path data. Only ever M, H and V, so it is trivially checkable. */
  solution: string;
}

export interface Maze {
  viewBox: string;
  /** Cells per side. */
  size: number;
  /** Wall segments, already merged into runs. */
  walls: string[];
  /**
   * Walls per cell, row-major, each in [N, E, S, W] order.
   *
   * `walls` above is merged for drawing and cannot be walked; this is the grid
   * itself, for callers that need to move through the maze a cell at a time —
   * the rules diagrams simulate a search run over it.
   */
  cells: CellWalls[];
  /** One route per corner, longest first. */
  routes: Route[];
  goal: { x: number; y: number; size: number };
}

/** Side of one cell in viewBox units. Walls land on multiples, paths on centres. */
export const CELL = 20;

/**
 * The four moves, indexed to match `CellWalls`. Exported so anything walking a
 * maze agrees with the generator about which slot is which wall — getting that
 * mapping wrong silently produces a route that passes through walls.
 */
export const DIRS = [
  { dx: 0, dy: -1, wall: 0, opp: 2 },
  { dx: 1, dy: 0, wall: 1, opp: 3 },
  { dx: 0, dy: 1, wall: 2, opp: 0 },
  { dx: -1, dy: 0, wall: 3, opp: 1 },
] as const;

/** Injectable so tests can pin a sequence; production always uses Math.random. */
export type Rand = () => number;

/**
 * Generates one maze, solves it from all four corners, and emits SVG-ready
 * geometry.
 *
 * `size` must be even, since the goal is a 2x2 room centred on the grid.
 */
export function generateMaze(size: number, rand: Rand = Math.random, braid = 0): Maze {
  if (size < 4 || size % 2 !== 0) {
    throw new Error(`maze size must be an even number of at least 4, got ${size}`);
  }

  const W = size;
  const H = size;
  const idx = (x: number, y: number) => y * W + x;
  const walls: CellWalls[] = Array.from({ length: W * H }, () => [true, true, true, true]);

  // Randomised depth-first carve. It produces long corridors with few
  // junctions, which reads better at speed than the tight braid a Prim carve
  // gives — at splash size a braid is just texture.
  const seen = new Set([idx(0, H - 1)]);
  const stack: Cell[] = [{ x: 0, y: H - 1 }];
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const open = DIRS.filter((d) => {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      return nx >= 0 && nx < W && ny >= 0 && ny < H && !seen.has(idx(nx, ny));
    });
    if (!open.length) {
      stack.pop();
      continue;
    }
    const d = open[Math.floor(rand() * open.length)]!;
    const nx = cur.x + d.dx;
    const ny = cur.y + d.dy;
    walls[idx(cur.x, cur.y)]![d.wall] = false;
    walls[idx(nx, ny)]![d.opp] = false;
    seen.add(idx(nx, ny));
    stack.push({ x: nx, y: ny });
  }

  // A depth-first carve leaves a *perfect* maze: exactly one route between any
  // two cells. That is fine for the splash, and quietly wrong for teaching the
  // rules — with a single route, exploring badly cannot cost you a slower speed
  // run, because there is no second route to miss. Real competition mazes carry
  // loops for exactly this reason, so knocking a few extra walls down is both
  // more faithful and what makes the search-versus-speed lesson land.
  //
  // Off by default, so the splash keeps the long clean corridors it reads best
  // with; the rules diagrams turn it on.
  if (braid > 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // North and east only. Every wall is shared by two cells, so
        // considering all four directions would give each one two chances.
        for (const d of [DIRS[0]!, DIRS[1]!]) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          // Never the outer boundary: the maze has to stay a closed box.
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (!walls[idx(x, y)]![d.wall]) continue;
          if (rand() >= braid) continue;
          walls[idx(x, y)]![d.wall] = false;
          walls[idx(nx, ny)]![d.opp] = false;
        }
      }
    }
  }

  // The goal is one open 2x2 room at the centre, per competition rules.
  const G0 = W / 2 - 1;
  const G1 = W / 2;
  const GOAL: Cell[] = [
    { x: G0, y: G0 },
    { x: G1, y: G0 },
    { x: G0, y: G1 },
    { x: G1, y: G1 },
  ];
  walls[idx(G0, G0)]![1] = false;
  walls[idx(G1, G0)]![3] = false;
  walls[idx(G0, G1)]![1] = false;
  walls[idx(G1, G1)]![3] = false;
  walls[idx(G0, G0)]![2] = false;
  walls[idx(G0, G1)]![0] = false;
  walls[idx(G1, G0)]![2] = false;
  walls[idx(G1, G1)]![0] = false;

  /** Shortest cell-by-cell route from a starting cell into the goal room. */
  const bfsTo = (start: Cell): Cell[] => {
    const prev = new Map<number, Cell>();
    const queue: Cell[] = [start];
    const visited = new Set([idx(start.x, start.y)]);
    let landing: Cell | null = null;

    while (queue.length) {
      const cur = queue.shift() as Cell;
      if (GOAL.some((g) => g.x === cur.x && g.y === cur.y)) {
        landing = cur;
        break;
      }
      for (const d of DIRS) {
        if (walls[idx(cur.x, cur.y)]![d.wall]) continue;
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (visited.has(idx(nx, ny))) continue;
        visited.add(idx(nx, ny));
        prev.set(idx(nx, ny), cur);
        queue.push({ x: nx, y: ny });
      }
    }

    // A depth-first carve spans every cell, so this is unreachable — but it
    // would be a silent blank splash rather than an error if it ever were not.
    if (!landing) throw new Error("maze has no route from a corner to the goal");

    const route: Cell[] = [];
    for (let cur: Cell | undefined = landing; cur; cur = prev.get(idx(cur.x, cur.y))) {
      route.unshift(cur);
      if (cur.x === start.x && cur.y === start.y) break;
    }
    return route;
  };

  /**
   * Turns a cell route into SVG path data, ending on this mouse's own parking
   * cell. Four mice all stopping dead centre would stack into one, hiding three
   * of them at the exact moment they arrive.
   */
  const buildPath = (route: Cell[], park: Cell): Route => {
    const pts: Array<[number, number]> = route.map((c) => [
      c.x * CELL + CELL / 2,
      c.y * CELL + CELL / 2,
    ]);

    // Two axis-aligned moves rather than one diagonal. Both legs stay inside
    // the goal room, whose interior walls are gone, so neither can cross one.
    const px = park.x * CELL + CELL / 2;
    const py = park.y * CELL + CELL / 2;
    const [lx, ly] = pts[pts.length - 1]!;
    if (lx !== px) pts.push([px, ly]);
    if (ly !== py) pts.push([px, py]);

    // Collapse runs that continue in the same direction, so the path carries
    // one command per turn.
    const legs: Array<{ axis: "H" | "V"; to: number }> = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      // The emitter below only speaks H and V, so a diagonal would be silently
      // flattened onto one axis and the route would cut through a wall. Fail
      // loudly instead of drawing a lie.
      if (ax !== bx && ay !== by) {
        throw new Error(`diagonal step ${ax},${ay} -> ${bx},${by}`);
      }
      const axis: "H" | "V" = bx === ax ? "V" : "H";
      const last = legs[legs.length - 1];
      if (last && last.axis === axis) last.to = axis === "V" ? by : bx;
      else legs.push({ axis, to: axis === "V" ? by : bx });
    }

    const [originX, originY] = pts[0]!;
    let d = `M${originX} ${originY}`;
    let pathLength = 0;
    const cursor = [originX, originY];
    for (const leg of legs) {
      d += ` ${leg.axis}${leg.to}`;
      const axis = leg.axis === "V" ? 1 : 0;
      pathLength += Math.abs(leg.to - cursor[axis]!);
      cursor[axis] = leg.to;
    }

    return {
      start: { x: originX, y: originY },
      cells: route.length,
      turns: legs.length,
      pathLength,
      solution: d,
    };
  };

  // One mouse per corner. In a perfect maze each corner has exactly one route
  // to the centre, and those routes necessarily merge as they near the goal —
  // which is the part worth watching.
  const corners: Cell[] = [
    { x: 0, y: H - 1 },
    { x: W - 1, y: 0 },
    { x: W - 1, y: H - 1 },
    { x: 0, y: 0 },
  ];
  const cellRoutes = corners.map(bfsTo);

  // Each mouse claims its own cell of the goal room, nearest-first, so none
  // doubles back across the room to park.
  const free = GOAL.slice();
  const parks = cellRoutes.map((route) => {
    const land = route[route.length - 1]!;
    let best = 0;
    free.forEach((g, i) => {
      const dist = Math.abs(g.x - land.x) + Math.abs(g.y - land.y);
      const chosen = free[best]!;
      const bestDist = Math.abs(chosen.x - land.x) + Math.abs(chosen.y - land.y);
      if (dist < bestDist) best = i;
    });
    return free.splice(best, 1)[0]!;
  });

  // Longest route leads, so the gold mouse always has the run worth watching.
  // With a random carve the bottom-left corner is often the dullest.
  const routes = cellRoutes
    .map((r, i) => buildPath(r, parks[i]!))
    .sort((a, b) => b.pathLength - a.pathLength);

  return {
    viewBox: `0 0 ${W * CELL} ${H * CELL}`,
    size: W,
    walls: mergeWallRuns(walls, W, H),
    cells: walls,
    routes,
    goal: { x: G0 * CELL, y: G0 * CELL, size: 2 * CELL },
  };
}

/**
 * Collapses the per-cell wall flags into as few SVG paths as possible, so the
 * markup carries tens of paths rather than a thousand.
 */
function mergeWallRuns(walls: CellWalls[], W: number, H: number): string[] {
  const idx = (x: number, y: number) => y * W + x;
  const horizontal = new Set<string>();
  const vertical = new Set<string>();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const w = walls[idx(x, y)]!;
      if (w[0]) horizontal.add(`${x},${y}`);
      if (w[2]) horizontal.add(`${x},${y + 1}`);
      if (w[3]) vertical.add(`${x},${y}`);
      if (w[1]) vertical.add(`${x + 1},${y}`);
    }
  }

  const runs: string[] = [];
  for (let y = 0; y <= H; y++) {
    let run: number | null = null;
    for (let x = 0; x <= W; x++) {
      if (x < W && horizontal.has(`${x},${y}`)) {
        if (run === null) run = x;
      } else if (run !== null) {
        runs.push(`M${run * CELL} ${y * CELL}H${x * CELL}`);
        run = null;
      }
    }
  }
  for (let x = 0; x <= W; x++) {
    let run: number | null = null;
    for (let y = 0; y <= H; y++) {
      if (y < H && vertical.has(`${x},${y}`)) {
        if (run === null) run = y;
      } else if (run !== null) {
        runs.push(`M${x * CELL} ${run * CELL}V${y * CELL}`);
        run = null;
      }
    }
  }
  return runs;
}

/**
 * Draws until the lead route lands in a sensible band, then keeps it.
 *
 * A carve can drop the goal a few cells from a corner, or send the lead mouse
 * on a ninety-cell tour. Both make a poor splash — one is over before it
 * registers, the other outstays the intro. This keeps the maze random while
 * ruling out the extremes, and falls back to the closest attempt so it can
 * never spin.
 */
export function pickMaze(
  size: number,
  minCells: number,
  maxCells: number,
  tries = 60,
  rand: Rand = Math.random,
): Maze {
  let best = generateMaze(size, rand);
  let bestMiss = Infinity;

  for (let i = 0; i < tries; i++) {
    const maze = i === 0 ? best : generateMaze(size, rand);
    const cells = maze.routes[0]!.cells;
    if (cells >= minCells && cells <= maxCells) return maze;
    const miss = cells < minCells ? minCells - cells : cells - maxCells;
    if (miss < bestMiss) {
      bestMiss = miss;
      best = maze;
    }
  }
  return best;
}

/** Competition-standard grid. Reads well at splash scale. */
export const SPLASH_GRID = 16;
/**
 * The loader is a fraction of the splash's size, where a 16x16 grid collapses
 * into mush. Eight cells a side stays legible at ~120px.
 */
export const LOADER_GRID = 8;

export const newSplashMaze = (rand?: Rand) => pickMaze(SPLASH_GRID, 34, 60, 60, rand);
export const newLoaderMaze = (rand?: Rand) => pickMaze(LOADER_GRID, 9, 16, 60, rand);

/** Units per second. The pace that reads as purposeful rather than frantic. */
export const MOUSE_SPEED = 520;
/** Head start for the walls to sweep in before any mouse moves. */
const LEAD_IN_S = 0.62;
/**
 * Bounds on the run, as a safety net rather than a working part.
 *
 * They are deliberately set outside what the cell bands in `newSplashMaze` /
 * `newLoaderMaze` can actually produce: the shortest lead route those allow is
 * ~660 units, which is 1.27s at the pace above. If a bound ever bound, it
 * would stretch or squash that maze's run and the mice would visibly travel at
 * a different speed from the previous visitor's — which is the whole thing
 * this pacing exists to prevent. They exist only so a degenerate maze cannot
 * produce a run of a tenth of a second or half a minute.
 */
const MIN_RUN_S = 1.2;
const MAX_RUN_S = 2.4;

export interface MazeTiming {
  /** When the mice start, in seconds from the top of the animation. */
  leadInS: number;
  /** How long the *longest* route takes; shorter routes get a later start. */
  runS: number;
  /** When the goal lights up. */
  goalS: number;
  /** When the wordmark rises. */
  lockupS: number;
  /** Whole animation, in ms — what the splash holds for. */
  totalMs: number;
}

/**
 * Times the run from the longest route, so a mouse covers ground at the same
 * pace whatever maze it drew. Splash only — the loader laps endlessly at its
 * own pace and has no total to keep to.
 *
 * This is the piece that makes randomness viable: with a fixed duration a long
 * carve would sprint and a short one would crawl, and the intro would feel
 * different on every visit for no reason the visitor could name.
 */
export function mazeTiming(maze: Maze): MazeTiming {
  const maxLength = Math.max(...maze.routes.map((r) => r.pathLength));
  const runS = Math.min(MAX_RUN_S, Math.max(MIN_RUN_S, maxLength / MOUSE_SPEED));
  const lockupS = LEAD_IN_S + runS + 0.12;
  return {
    leadInS: LEAD_IN_S,
    runS,
    goalS: LEAD_IN_S + runS - 0.1,
    lockupS,
    // The lockup's own rise, plus a beat to read it on.
    totalMs: Math.round((lockupS + 0.62 + 0.2) * 1000),
  };
}

/**
 * Duration and delay for one mouse.
 *
 * Duration scales with route length so every mouse moves at the same speed;
 * the delay makes up the difference so they still converge on the same beat.
 * That shared arrival is the whole reason there are four of them.
 */
export function routePacing(route: Route, maze: Maze, timing: MazeTiming) {
  const maxLength = Math.max(...maze.routes.map((r) => r.pathLength));
  const durationS = (route.pathLength / maxLength) * timing.runS;
  return { durationS, delayS: timing.leadInS + (timing.runS - durationS) };
}

/**
 * Groups walls into bands by distance from the lead mouse's corner, so the
 * reveal sweeps outward from where the run begins rather than all at once —
 * the arena reads as being mapped, not merely switched on.
 */
export function wallBands(maze: Maze, bands: number): string[][] {
  const origin = maze.routes[0]!.start;
  const span = Math.hypot(maze.size * CELL, maze.size * CELL);
  const grouped: string[][] = Array.from({ length: bands }, () => []);

  for (const d of maze.walls) {
    // Runs are "M<x> <y>H<x2>" or "M<x> <y>V<y2>", so which number is the far
    // end depends on the command.
    const [a = 0, b = 0, c = 0] = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const isHorizontal = d.includes("H");
    const x = isHorizontal ? (a + c) / 2 : a;
    const y = isHorizontal ? b : (b + c) / 2;
    const dist = Math.hypot(x - origin.x, y - origin.y);
    grouped[Math.min(bands - 1, Math.floor((dist / span) * bands))]!.push(d);
  }
  return grouped;
}
