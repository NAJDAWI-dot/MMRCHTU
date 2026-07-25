/**
 * Maze layout, direction helpers, and robot definitions shared by the
 * Pac Mouse Classic Maze and First-Person game modes. Ported from the
 * standalone ieee-ras-mouse-maze site (vanilla JS) and restyled to MMRC's
 * official IEEE RAS palette. Each mode clones its own working copy of RAW so
 * pellet state stays independent between modes.
 *
 * The maze is fully enclosed: row 9 used to be an open side tunnel that
 * wrapped the mouse and robots from one edge to the other. Both edges are now
 * walls, so there is no wrap-around travel — see isWall(), which treats any
 * column outside the grid as solid.
 */

export const RAW = [
  "###################",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.###.#.###.####",
  "###..#.......#..###",
  "###.##.##-##.##.###",
  "#......#   #......#",
  "###.##.#####.##.###",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.###.#.###.####",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.###.#.###.##.#",
  "#.................#",
  "###################",
] as const;

export const ROWS = RAW.length;
export const COLS = RAW[0].length;
export const TILE = 24;

/**
 * Global pace multiplier. Everything (mouse and robots) derives from
 * baseSpeed() in each mode, so lowering this slows the whole game uniformly
 * without changing the chase balance.
 *
 * MOUSE_SPEED_SCALE slows the mouse a little further on top of that. It stays
 * above ROBOT_SPEED_SCALE so the mouse can still outrun a patrolling robot in
 * a straight line — dropping it below that makes the game unwinnable.
 */
export const GAME_SPEED_SCALE = 0.75;
export const MOUSE_SPEED_SCALE = 0.92;
export const ROBOT_SPEED_SCALE = 0.85;

export type Dir = "up" | "down" | "left" | "right";

export const DIRS: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export interface RobotDef {
  name: "REX" | "VOLT" | "CYBER" | "SERVO";
  color: string;
  home: { r: number; c: number };
  house: boolean;
}

// Colors chosen for hue-spread accessibility (not just brand color) so ghosts
// stay distinguishable for color-blind players; GOLD is a gameplay accent,
// not part of the IEEE RAS brand palette.
export const GOLD = "#F2A900";
export const NEON = "#b45adc";

export const ROBOT_DEFS: RobotDef[] = [
  { name: "REX", color: "#c62f45", home: { r: 7, c: 9 }, house: false }, // chaser
  { name: "VOLT", color: "#ff6fa8", home: { r: 9, c: 8 }, house: true }, // ambusher
  { name: "CYBER", color: "#2fd0c6", home: { r: 9, c: 9 }, house: true }, // flank
  { name: "SERVO", color: "#ff9a3d", home: { r: 9, c: 10 }, house: true }, // patrol
];

export type MazeGrid = string[][];

export function buildMaze(): MazeGrid {
  return RAW.map((r) => r.split(""));
}

export function countPellets(maze: MazeGrid): number {
  let n = 0;
  for (const row of maze) for (const c of row) if (c === "." || c === "o") n++;
  return n;
}

export function isWall(maze: MazeGrid, r: number, c: number, forGhost: boolean): boolean {
  // Out of bounds is solid in both axes — no column wrapping, so nothing can
  // travel off one side of the maze and reappear on the other.
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  const t = maze[r]?.[c];
  if (t === "#") return true;
  if (t === "-") return !forGhost; // house door: robots only
  return false;
}

export function tileCenter(r: number, c: number): { x: number; y: number } {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

/**
 * The tile an entity currently occupies. Clamped rather than wrapped: the maze
 * is enclosed, so a position can only land outside the grid through float drift
 * at the outer walls.
 */
export function entTile(e: { x: number; y: number }): { r: number; c: number } {
  return {
    r: Math.min(Math.max(Math.floor(e.y / TILE), 0), ROWS - 1),
    c: Math.min(Math.max(Math.floor(e.x / TILE), 0), COLS - 1),
  };
}

export interface MazeEntity {
  x: number;
  y: number;
  dir: Dir;
  speed: number;
}

/**
 * Advances an entity one frame, making its turn decision at the instant it
 * crosses a tile centre.
 *
 * This deliberately does NOT ask "am I near a centre?". An earlier version did,
 * snapping the entity back onto any centre within 1.5px before every move, which
 * silently coupled that tolerance to the speed: once a per-frame step fell below
 * 1.5px the entity was dragged back to the centre it had just left on the very
 * next frame and never escaped its tile — it vibrated on the spot instead of
 * travelling. Crossing detection holds at any speed and carries the leftover
 * distance through the turn, so no movement is lost to the snap.
 *
 * `canGo` is evaluated against the entity's live position, so it must be called
 * only after the snap. `chooseDir` is the entity's turn decision (the player's
 * queued direction, or the robot AI) and runs at the centre, the only point in a
 * tile where changing direction is legal.
 */
export function advance(e: MazeEntity, canGo: (dir: Dir) => boolean, chooseDir?: () => void): void {
  const d0 = DIRS[e.dir];
  const t = entTile(e);
  const ctr = tileCenter(t.r, t.c);
  // Signed distance to this tile's centre along the axis of travel: positive
  // means the centre is still ahead of us this frame.
  const toCentre = d0.x !== 0 ? (ctr.x - e.x) * d0.x : (ctr.y - e.y) * d0.y;

  if (toCentre >= 0 && toCentre <= e.speed) {
    e.x = ctr.x;
    e.y = ctr.y;
    chooseDir?.();
    // Nothing ahead to move into — park on the centre facing the wall.
    if (!canGo(e.dir)) return;
    const d = DIRS[e.dir];
    const remain = e.speed - toCentre;
    e.x += d.x * remain;
    e.y += d.y * remain;
    return;
  }

  e.x += d0.x * e.speed;
  e.y += d0.y * e.speed;
}
