import type { Direction, Vec2 } from "@/game/engine/types";

export const DIRECTION_VECTORS: Record<Exclude<Direction, "none">, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function directionVector(direction: Direction): Vec2 {
  if (direction === "none") return { x: 0, y: 0 };
  return DIRECTION_VECTORS[direction];
}

export function isOpposite(a: Direction, b: Direction): boolean {
  const opposites: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
    none: "none",
  };
  return opposites[a] === b;
}

/** True when a position sits exactly on a grid intersection (within epsilon). */
export function isGridAligned(pos: Vec2, epsilon = 0.001): boolean {
  return Math.abs(pos.x - Math.round(pos.x)) < epsilon && Math.abs(pos.y - Math.round(pos.y)) < epsilon;
}

export function snapToGrid(pos: Vec2): Vec2 {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}
