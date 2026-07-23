import type { Maze, TileType, Vec2 } from "@/game/engine/types";

export const MAZE_WIDTH = 19;
export const MAZE_HEIGHT = 21;

const HOUSE_TOP = 8;
const HOUSE_BOTTOM = 10; // kept odd span (8-10) so the center row is an integer
const HOUSE_LEFT = 7;
const HOUSE_RIGHT = 11;
const HOUSE_DOOR_COL = 9;
const HOUSE_DOOR_ROW = HOUSE_TOP - 1;

export const TUNNEL_ROW = 10; // must be an odd row so it's a corridor, not a lattice pillar

/**
 * Generates a lattice-style maze (a grid of 1x1 wall pillars surrounded by
 * corridors), which is trivially fully-connected and doubles as a visual nod
 * to the micromouse competition's own grid maze. A rectangular ghost house
 * sits at the center with a single door, and a left/right tunnel wraps
 * around the middle row.
 */
export function createMaze(): Maze {
  const tiles: TileType[][] = [];

  for (let row = 0; row < MAZE_HEIGHT; row++) {
    const rowTiles: TileType[] = [];
    for (let col = 0; col < MAZE_WIDTH; col++) {
      rowTiles.push(computeBaseTile(row, col));
    }
    tiles.push(rowTiles);
  }

  carveGhostHouse(tiles);
  placePowerPellets(tiles);
  carveTunnel(tiles);

  const { totalPellets } = countPellets(tiles);

  return {
    width: MAZE_WIDTH,
    height: MAZE_HEIGHT,
    tiles,
    totalPellets,
    pelletsRemaining: totalPellets,
    tunnelExits: [
      [
        { x: 0, y: TUNNEL_ROW },
        { x: MAZE_WIDTH - 1, y: TUNNEL_ROW },
      ],
    ],
  };
}

function computeBaseTile(row: number, col: number): TileType {
  const isBorder = row === 0 || col === 0 || row === MAZE_HEIGHT - 1 || col === MAZE_WIDTH - 1;
  if (isBorder) return "wall";

  const isPillar = row % 2 === 0 && col % 2 === 0;
  return isPillar ? "wall" : "pellet";
}

function carveGhostHouse(tiles: TileType[][]): void {
  for (let row = HOUSE_TOP; row <= HOUSE_BOTTOM; row++) {
    for (let col = HOUSE_LEFT; col <= HOUSE_RIGHT; col++) {
      const rowTiles = tiles[row];
      if (rowTiles) rowTiles[col] = "ghost-house";
    }
  }
  const doorRow = tiles[HOUSE_DOOR_ROW];
  if (doorRow) doorRow[HOUSE_DOOR_COL] = "empty";
}

function placePowerPellets(tiles: TileType[][]): void {
  const corners: Vec2[] = [
    { x: 1, y: 1 },
    { x: MAZE_WIDTH - 2, y: 1 },
    { x: 1, y: MAZE_HEIGHT - 2 },
    { x: MAZE_WIDTH - 2, y: MAZE_HEIGHT - 2 },
  ];
  for (const { x, y } of corners) {
    const rowTiles = tiles[y];
    if (rowTiles) rowTiles[x] = "power-pellet";
  }
}

function carveTunnel(tiles: TileType[][]): void {
  const rowTiles = tiles[TUNNEL_ROW];
  if (!rowTiles) return;
  rowTiles[0] = "tunnel";
  rowTiles[MAZE_WIDTH - 1] = "tunnel";
}

function countPellets(tiles: TileType[][]): { totalPellets: number } {
  let count = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile === "pellet" || tile === "power-pellet") count++;
    }
  }
  return { totalPellets: count };
}

export function getTile(maze: Maze, pos: Vec2): TileType {
  const row = maze.tiles[Math.round(pos.y)];
  return row?.[Math.round(pos.x)] ?? "wall";
}

export function isWalkable(tile: TileType, forGhost: boolean): boolean {
  if (tile === "wall") return false;
  if (tile === "ghost-house") return forGhost;
  return true;
}

export function wrapPosition(maze: Maze, pos: Vec2): Vec2 {
  for (const [a, b] of maze.tunnelExits) {
    if (Math.round(pos.y) !== a.y) continue;
    if (pos.x < 0) return { x: b.x, y: pos.y };
    if (pos.x > maze.width - 1) return { x: a.x, y: pos.y };
  }
  return pos;
}

export const GHOST_HOUSE_CENTER: Vec2 = {
  x: (HOUSE_LEFT + HOUSE_RIGHT) / 2,
  y: (HOUSE_TOP + HOUSE_BOTTOM) / 2,
};

export const GHOST_HOUSE_DOOR: Vec2 = { x: HOUSE_DOOR_COL, y: HOUSE_DOOR_ROW };
