export type Direction = "up" | "down" | "left" | "right" | "none";

export interface Vec2 {
  x: number; // grid column, can be fractional mid-tile
  y: number; // grid row, can be fractional mid-tile
}

export type TileType =
  | "wall"
  | "empty"
  | "pellet"
  | "power-pellet"
  | "ghost-house"
  | "tunnel";

export interface Maze {
  width: number;
  height: number;
  tiles: TileType[][]; // [row][col], mutated as pellets are eaten
  totalPellets: number;
  pelletsRemaining: number;
  tunnelExits: [Vec2, Vec2][]; // wrap-around pairs, e.g. left/right edge tunnel
}

export type GhostName = "blinky" | "pinky" | "inky" | "clyde";
export type GhostMode = "scatter" | "chase" | "frightened" | "eaten" | "house";

export interface Ghost {
  name: GhostName;
  color: string;
  position: Vec2;
  direction: Direction;
  mode: GhostMode;
  modeTimer: number; // ms remaining in current scatter/chase phase
  speed: number; // tiles per second
  scatterTarget: Vec2; // fixed corner
  houseExitDelayMs: number; // ms after game start before this ghost may leave the house
}

export interface Mouse {
  position: Vec2;
  direction: Direction;
  nextDirection: Direction; // buffered input, applied when grid-aligned
  speed: number; // tiles per second
  lives: number;
}

export type GamePhase =
  | "ready"
  | "playing"
  | "paused"
  | "level-complete"
  | "life-lost"
  | "game-over"
  | "victory";

export interface GameState {
  phase: GamePhase;
  level: number;
  score: number;
  highScore: number;
  ghostChain: number; // consecutive ghosts eaten during current frightened window
  maze: Maze;
  mouse: Mouse;
  ghosts: Ghost[];
  frightenedTimer: number; // ms remaining of power-pellet effect, 0 if inactive
  elapsedMs: number;
  phaseTimer: number; // generic countdown used by transient phases (life-lost, level-complete)
  rngSeed: number;
  reducedMotion: boolean;
}

export interface InputSnapshot {
  requestedDirection: Direction;
  pause: boolean;
}

export interface Rng {
  next(): number; // [0, 1)
  nextInt(maxExclusive: number): number;
}
