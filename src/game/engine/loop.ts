import type { GameState, InputSnapshot, Rng } from "@/game/engine/types";

export const TICK_MS = 1000 / 60;
const MAX_FRAME_DT = 250; // clamp on tab-switch stalls / debugger pauses

export type TickFn = (state: GameState, dtMs: number, input: InputSnapshot, rng: Rng) => GameState;

export interface GameLoop {
  start: () => void;
  stop: () => void;
  getState: () => GameState;
  resetState: (state: GameState) => void;
}

export function createGameLoop(
  initialState: GameState,
  onTick: TickFn,
  onRender: (state: GameState) => void,
  getInput: () => InputSnapshot,
  rng: Rng
): GameLoop {
  let state = initialState;
  let accumulator = 0;
  let lastTime = 0;
  let rafId = 0;
  let running = false;

  function frame(now: number) {
    if (!running) return;
    const frameDt = Math.min(now - lastTime, MAX_FRAME_DT);
    lastTime = now;
    accumulator += frameDt;

    while (accumulator >= TICK_MS) {
      state = onTick(state, TICK_MS, getInput(), rng);
      accumulator -= TICK_MS;
    }

    onRender(state);
    rafId = requestAnimationFrame(frame);
  }

  return {
    start: () => {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(rafId);
    },
    getState: () => state,
    resetState: (nextState: GameState) => {
      state = nextState;
      accumulator = 0;
    },
  };
}
