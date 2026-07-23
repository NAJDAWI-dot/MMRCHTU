import type { Ghost, Maze, Mouse } from "@/game/engine/types";
import { getTile, isWalkable } from "@/game/engine/maze";
import { ghostEatScore, POINTS } from "@/game/engine/scoring";
import { frightenGhosts } from "@/game/engine/entities/ghost";
import { isGridAligned, snapToGrid } from "@/game/engine/direction";

const COLLISION_RADIUS = 0.5;

export interface PelletPickupResult {
  maze: Maze;
  scoreDelta: number;
  powerPelletEaten: boolean;
}

/** Removes a pellet under the mouse exactly once (only checked when grid-aligned). */
export function applyPelletPickup(maze: Maze, mouse: Mouse): PelletPickupResult {
  if (!isGridAligned(mouse.position)) {
    return { maze, scoreDelta: 0, powerPelletEaten: false };
  }

  const pos = snapToGrid(mouse.position);
  const tile = getTile(maze, pos);

  if (tile !== "pellet" && tile !== "power-pellet") {
    return { maze, scoreDelta: 0, powerPelletEaten: false };
  }

  const row = maze.tiles[pos.y];
  if (!row) return { maze, scoreDelta: 0, powerPelletEaten: false };

  const nextRow = [...row];
  nextRow[pos.x] = "empty";
  const nextTiles = maze.tiles.map((r, i) => (i === pos.y ? nextRow : r));

  return {
    maze: { ...maze, tiles: nextTiles, pelletsRemaining: maze.pelletsRemaining - 1 },
    scoreDelta: tile === "power-pellet" ? POINTS.powerPellet : POINTS.pellet,
    powerPelletEaten: tile === "power-pellet",
  };
}

export interface GhostCollisionResult {
  ghosts: Ghost[];
  scoreDelta: number;
  ghostChain: number;
  lifeLost: boolean;
}

/**
 * Resolves mouse-ghost overlaps: frightened ghosts get eaten (score + chain
 * bonus), normal ghosts cost the mouse a life. Distance-based, not
 * grid-based, so it works mid-tile.
 */
export function resolveGhostCollisions(
  mouse: Mouse,
  ghosts: Ghost[],
  ghostChain: number
): GhostCollisionResult {
  let scoreDelta = 0;
  let chain = ghostChain;
  let lifeLost = false;

  const nextGhosts = ghosts.map((ghost) => {
    if (ghost.mode === "eaten" || ghost.mode === "house") return ghost;

    const dx = ghost.position.x - mouse.position.x;
    const dy = ghost.position.y - mouse.position.y;
    if (dx * dx + dy * dy > COLLISION_RADIUS * COLLISION_RADIUS) return ghost;

    if (ghost.mode === "frightened") {
      scoreDelta += ghostEatScore(chain);
      chain += 1;
      return { ...ghost, mode: "eaten" as const };
    }

    lifeLost = true;
    return ghost;
  });

  return { ghosts: nextGhosts, scoreDelta, ghostChain: chain, lifeLost };
}

export function isPathBlocked(maze: Maze, position: Mouse["position"]): boolean {
  return !isWalkable(getTile(maze, position), false);
}

export { frightenGhosts };
