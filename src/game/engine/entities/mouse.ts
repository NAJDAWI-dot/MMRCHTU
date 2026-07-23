import type { Direction, Maze, Mouse, Vec2 } from "@/game/engine/types";
import { directionVector, isGridAligned, snapToGrid } from "@/game/engine/direction";
import { getTile, isWalkable, wrapPosition } from "@/game/engine/maze";

function canMoveTo(maze: Maze, from: Vec2, direction: Direction): boolean {
  if (direction === "none") return false;
  const vec = directionVector(direction);
  const target = wrapPosition(maze, { x: from.x + vec.x, y: from.y + vec.y });
  return isWalkable(getTile(maze, target), false);
}

/**
 * Pure per-tick mouse update: buffers the requested direction, applies it at
 * the next grid-aligned tile if legal, and advances position by speed * dt.
 * Called directly (in a loop, with a fixed dt) by unit tests — no DOM/timer
 * access here.
 */
export function updateMouse(
  mouse: Mouse,
  maze: Maze,
  dtSeconds: number,
  requestedDirection: Direction
): Mouse {
  let { position, direction, nextDirection } = mouse;

  if (requestedDirection !== "none") {
    nextDirection = requestedDirection;
  }

  if (isGridAligned(position)) {
    const aligned = snapToGrid(position);

    if (nextDirection !== "none" && canMoveTo(maze, aligned, nextDirection)) {
      direction = nextDirection;
    } else if (direction !== "none" && !canMoveTo(maze, aligned, direction)) {
      direction = "none";
    }

    position = aligned;
  }

  if (direction === "none") {
    return { ...mouse, position, direction, nextDirection };
  }

  const vec = directionVector(direction);
  const distance = mouse.speed * dtSeconds;
  let nextPosition: Vec2 = { x: position.x + vec.x * distance, y: position.y + vec.y * distance };
  nextPosition = wrapPosition(maze, nextPosition);

  return { ...mouse, position: nextPosition, direction, nextDirection };
}
