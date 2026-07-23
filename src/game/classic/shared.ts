/**
 * Maze layout, direction helpers, and robot definitions shared by the
 * Classic Maze and First-Person game modes. Ported from the standalone
 * ieee-ras-mouse-maze site (vanilla JS) and restyled to MMRC's official
 * IEEE RAS palette. Each mode clones its own working copy of RAW so pellet
 * state stays independent between modes.
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
  " ......#   #...... ",
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
export const TUNNEL_ROW = 9;

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
  if (r < 0 || r >= ROWS) return true;
  c = ((c % COLS) + COLS) % COLS;
  const t = maze[r]?.[c];
  if (t === "#") return true;
  if (t === "-") return !forGhost; // house door: robots only
  return false;
}
