import type { GameState, Ghost, InputSnapshot, Mouse, Rng } from "@/game/engine/types";
import { createMaze, GHOST_HOUSE_CENTER, MAZE_HEIGHT, MAZE_WIDTH } from "@/game/engine/maze";
import { updateMouse } from "@/game/engine/entities/mouse";
import { computeGlobalMode, updateGhost } from "@/game/engine/entities/ghost";
import { applyPelletPickup, frightenGhosts, resolveGhostCollisions } from "@/game/engine/collision";

export const LIVES_START = 3;
export const FRIGHTENED_DURATION_MS = 6_000;
export const READY_DURATION_MS = 2_000;
export const LIFE_LOST_DURATION_MS = 1_500;
export const LEVEL_COMPLETE_DURATION_MS = 2_000;
export const FINAL_LEVEL = 3;

const MOUSE_START = { x: 9, y: 15 };
const MOUSE_SPEED = 5; // tiles/sec
const GHOST_SPEED = 4.5;

function createInitialMouse(): Mouse {
  return {
    position: { ...MOUSE_START },
    direction: "none",
    nextDirection: "none",
    speed: MOUSE_SPEED,
    lives: LIVES_START,
  };
}

function createInitialGhosts(): Ghost[] {
  const house = GHOST_HOUSE_CENTER;
  return [
    {
      name: "blinky",
      color: "var(--color-ras-crimson)",
      position: { ...house },
      direction: "up",
      mode: "house",
      modeTimer: 0,
      speed: GHOST_SPEED,
      scatterTarget: { x: MAZE_WIDTH - 2, y: 1 },
      houseExitDelayMs: 0,
    },
    {
      name: "pinky",
      color: "var(--color-mood-rose)",
      position: { ...house },
      direction: "up",
      mode: "house",
      modeTimer: 0,
      speed: GHOST_SPEED,
      scatterTarget: { x: 1, y: 1 },
      houseExitDelayMs: 2_000,
    },
    {
      name: "inky",
      color: "var(--color-ras-purple)",
      position: { ...house },
      direction: "up",
      mode: "house",
      modeTimer: 0,
      speed: GHOST_SPEED,
      scatterTarget: { x: MAZE_WIDTH - 2, y: MAZE_HEIGHT - 2 },
      houseExitDelayMs: 5_000,
    },
    {
      name: "clyde",
      color: "var(--color-mood-orchid)",
      position: { ...house },
      direction: "up",
      mode: "house",
      modeTimer: 0,
      speed: GHOST_SPEED,
      scatterTarget: { x: 1, y: MAZE_HEIGHT - 2 },
      houseExitDelayMs: 8_000,
    },
  ];
}

export function createInitialState(seed: number, previousHighScore = 0): GameState {
  return {
    phase: "ready",
    level: 1,
    score: 0,
    highScore: previousHighScore,
    ghostChain: 0,
    maze: createMaze(),
    mouse: createInitialMouse(),
    ghosts: createInitialGhosts(),
    frightenedTimer: 0,
    elapsedMs: 0,
    phaseTimer: READY_DURATION_MS,
    rngSeed: seed,
    reducedMotion: false,
  };
}

export function tick(state: GameState, dtMs: number, input: InputSnapshot, rng: Rng): GameState {
  if (input.pause && state.phase === "playing") return { ...state, phase: "paused" };
  if (input.pause && state.phase === "paused") return { ...state, phase: "playing" };

  switch (state.phase) {
    case "ready":
      return tickReady(state, dtMs);
    case "playing":
      return tickPlaying(state, dtMs, input, rng);
    case "life-lost":
      return tickLifeLost(state, dtMs);
    case "level-complete":
      return tickLevelComplete(state, dtMs);
    case "paused":
    case "game-over":
    case "victory":
      return state;
  }
}

function tickReady(state: GameState, dtMs: number): GameState {
  const phaseTimer = state.phaseTimer - dtMs;
  if (phaseTimer > 0) return { ...state, phaseTimer };
  return { ...state, phase: "playing", phaseTimer: 0, elapsedMs: 0 };
}

function tickPlaying(state: GameState, dtMs: number, input: InputSnapshot, rng: Rng): GameState {
  const dtSeconds = dtMs / 1000;
  const elapsedMs = state.elapsedMs + dtMs;

  const mouse = updateMouse(state.mouse, state.maze, dtSeconds, input.requestedDirection);
  const pelletResult = applyPelletPickup(state.maze, mouse);

  let frightenedTimer = Math.max(0, state.frightenedTimer - dtMs);
  let ghostChain = state.ghostChain;
  let ghosts = state.ghosts;

  if (pelletResult.powerPelletEaten) {
    ghosts = frightenGhosts(ghosts);
    frightenedTimer = FRIGHTENED_DURATION_MS;
    ghostChain = 0;
  }

  const frightened = frightenedTimer > 0;
  const globalMode = computeGlobalMode(elapsedMs);
  const blinky = ghosts.find((g) => g.name === "blinky");
  const blinkyPosition = blinky ? blinky.position : mouse.position;

  ghosts = ghosts.map((ghost) =>
    updateGhost(ghost, {
      maze: pelletResult.maze,
      mouse,
      blinkyPosition,
      globalMode,
      elapsedPlayMs: elapsedMs,
      frightened,
      rng,
      dtSeconds,
    })
  );

  const collision = resolveGhostCollisions(mouse, ghosts, ghostChain);
  ghosts = collision.ghosts;
  ghostChain = collision.ghostChain;

  const score = state.score + pelletResult.scoreDelta + collision.scoreDelta;
  const highScore = Math.max(state.highScore, score);

  const nextState: GameState = {
    ...state,
    maze: pelletResult.maze,
    mouse,
    ghosts,
    ghostChain,
    frightenedTimer,
    elapsedMs,
    score,
    highScore,
  };

  if (collision.lifeLost) {
    const remainingLives = mouse.lives - 1;
    if (remainingLives <= 0) {
      return { ...nextState, mouse: { ...mouse, lives: 0 }, phase: "game-over" };
    }
    return {
      ...nextState,
      mouse: { ...mouse, lives: remainingLives },
      phase: "life-lost",
      phaseTimer: LIFE_LOST_DURATION_MS,
    };
  }

  if (pelletResult.maze.pelletsRemaining === 0) {
    return { ...nextState, phase: "level-complete", phaseTimer: LEVEL_COMPLETE_DURATION_MS };
  }

  return nextState;
}

function tickLifeLost(state: GameState, dtMs: number): GameState {
  const phaseTimer = state.phaseTimer - dtMs;
  if (phaseTimer > 0) return { ...state, phaseTimer };

  return {
    ...state,
    mouse: { ...createInitialMouse(), lives: state.mouse.lives },
    ghosts: createInitialGhosts(),
    frightenedTimer: 0,
    ghostChain: 0,
    phase: "ready",
    phaseTimer: READY_DURATION_MS,
    elapsedMs: 0,
  };
}

function tickLevelComplete(state: GameState, dtMs: number): GameState {
  const phaseTimer = state.phaseTimer - dtMs;
  if (phaseTimer > 0) return { ...state, phaseTimer };

  if (state.level >= FINAL_LEVEL) {
    return { ...state, phase: "victory" };
  }

  return {
    ...state,
    level: state.level + 1,
    maze: createMaze(),
    mouse: { ...createInitialMouse(), lives: state.mouse.lives },
    ghosts: createInitialGhosts(),
    frightenedTimer: 0,
    ghostChain: 0,
    phase: "ready",
    phaseTimer: READY_DURATION_MS,
    elapsedMs: 0,
  };
}

export function restartGame(seed: number, previousHighScore: number): GameState {
  return createInitialState(seed, previousHighScore);
}
