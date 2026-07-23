import type { Direction, Ghost, GhostMode, Maze, Mouse, Rng, Vec2 } from "@/game/engine/types";
import { DIRECTION_VECTORS, directionVector, isGridAligned, isOpposite, snapToGrid } from "@/game/engine/direction";
import { getTile, isWalkable, wrapPosition, GHOST_HOUSE_CENTER } from "@/game/engine/maze";

type CardinalDirection = "up" | "down" | "left" | "right";
const ALL_DIRECTIONS: CardinalDirection[] = ["up", "down", "left", "right"];

const FRIGHTENED_SPEED_FACTOR = 0.6;
const EATEN_SPEED_FACTOR = 2;

/** Classic scatter/chase schedule, shared by every non-frightened/eaten ghost. */
const MODE_SCHEDULE: { mode: "scatter" | "chase"; durationMs: number }[] = [
  { mode: "scatter", durationMs: 7_000 },
  { mode: "chase", durationMs: 20_000 },
  { mode: "scatter", durationMs: 7_000 },
  { mode: "chase", durationMs: 20_000 },
  { mode: "scatter", durationMs: 5_000 },
  { mode: "chase", durationMs: 20_000 },
  { mode: "scatter", durationMs: 5_000 },
  { mode: "chase", durationMs: Number.POSITIVE_INFINITY },
];

export function computeGlobalMode(elapsedPlayMs: number): "scatter" | "chase" {
  let remaining = elapsedPlayMs;
  for (const phase of MODE_SCHEDULE) {
    if (remaining < phase.durationMs) return phase.mode;
    remaining -= phase.durationMs;
  }
  return "chase";
}

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function aheadOf(pos: Vec2, direction: Direction, tiles: number): Vec2 {
  const vec = directionVector(direction);
  return { x: pos.x + vec.x * tiles, y: pos.y + vec.y * tiles };
}

/** Per-ghost chase target, following each classic ghost's distinct personality. */
export function computeChaseTarget(ghost: Ghost, mouse: Mouse, blinkyPosition: Vec2): Vec2 {
  switch (ghost.name) {
    case "blinky":
      return mouse.position;
    case "pinky":
      return aheadOf(mouse.position, mouse.direction, 4);
    case "inky": {
      const pivot = aheadOf(mouse.position, mouse.direction, 2);
      return { x: 2 * pivot.x - blinkyPosition.x, y: 2 * pivot.y - blinkyPosition.y };
    }
    case "clyde": {
      const farEnough = distanceSquared(ghost.position, mouse.position) > 64; // 8 tiles
      return farEnough ? mouse.position : ghost.scatterTarget;
    }
  }
}

function walkableDirections(maze: Maze, from: Vec2, currentDirection: Direction, mode: GhostMode): CardinalDirection[] {
  const inHouse = getTile(maze, from) === "ghost-house";
  return ALL_DIRECTIONS.filter((dir) => {
    if (mode !== "frightened" && mode !== "eaten" && isOpposite(dir, currentDirection)) return false;
    const vec = DIRECTION_VECTORS[dir];
    const target = wrapPosition(maze, { x: from.x + vec.x, y: from.y + vec.y });
    const tile = getTile(maze, target);
    if (tile === "ghost-house" && !inHouse && mode !== "eaten") return false;
    return isWalkable(tile, true);
  });
}

function chooseDirection(
  maze: Maze,
  from: Vec2,
  currentDirection: Direction,
  mode: GhostMode,
  target: Vec2,
  rng: Rng
): Direction {
  const options = walkableDirections(maze, from, currentDirection, mode);
  if (options.length === 0) return currentDirection === "none" ? "up" : currentDirection;

  if (mode === "frightened") {
    return options[rng.nextInt(options.length)] ?? options[0]!;
  }

  let best = options[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const dir of options) {
    const vec = DIRECTION_VECTORS[dir];
    const candidate = { x: from.x + vec.x, y: from.y + vec.y };
    const dist = distanceSquared(candidate, target);
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

export interface GhostUpdateContext {
  maze: Maze;
  mouse: Mouse;
  blinkyPosition: Vec2;
  globalMode: "scatter" | "chase";
  elapsedPlayMs: number;
  frightened: boolean;
  rng: Rng;
  dtSeconds: number;
}

export function updateGhost(ghost: Ghost, ctx: GhostUpdateContext): Ghost {
  const { maze, mouse, blinkyPosition, globalMode, elapsedPlayMs, frightened, rng, dtSeconds } = ctx;

  let mode: GhostMode = ghost.mode;

  if (mode === "house") {
    if (elapsedPlayMs >= ghost.houseExitDelayMs) {
      mode = frightened ? "frightened" : globalMode;
    } else {
      return ghost; // waiting in the house, no movement
    }
  } else if (mode === "eaten") {
    const aligned = isGridAligned(ghost.position) && snapToGrid(ghost.position);
    const reachedHouse = aligned && aligned.x === GHOST_HOUSE_CENTER.x && aligned.y === GHOST_HOUSE_CENTER.y;
    if (reachedHouse) {
      mode = frightened ? "frightened" : globalMode;
    }
  } else {
    // was scatter, chase, or frightened — resolve against current frighten state
    mode = frightened ? "frightened" : globalMode;
  }

  let { position, direction } = ghost;

  if (isGridAligned(position)) {
    const aligned = snapToGrid(position);
    const target =
      mode === "eaten"
        ? GHOST_HOUSE_CENTER
        : mode === "frightened"
          ? aligned // direction chosen randomly, target unused
          : computeChaseTarget(ghost, mouse, blinkyPosition);
    direction = chooseDirection(maze, aligned, direction, mode, target, rng);
    position = aligned;
  }

  const speedFactor = mode === "frightened" ? FRIGHTENED_SPEED_FACTOR : mode === "eaten" ? EATEN_SPEED_FACTOR : 1;
  const vec = directionVector(direction);
  const distance = ghost.speed * speedFactor * dtSeconds;
  position = wrapPosition(maze, { x: position.x + vec.x * distance, y: position.y + vec.y * distance });

  return { ...ghost, position, direction, mode };
}

/** Called when a power pellet is eaten: flips every non-eaten ghost frightened. */
export function frightenGhosts(ghosts: Ghost[]): Ghost[] {
  return ghosts.map((g) => (g.mode === "eaten" || g.mode === "house" ? g : { ...g, mode: "frightened" }));
}
