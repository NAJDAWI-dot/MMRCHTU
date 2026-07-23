import { describe, expect, it } from "vitest";
import { createInitialState, READY_DURATION_MS, tick } from "@/game/engine/stateMachine";
import { TICK_MS } from "@/game/engine/loop";
import { createRng } from "@/game/engine/rng";

function runTicks(state: ReturnType<typeof createInitialState>, count: number, rng: ReturnType<typeof createRng>) {
  let s = state;
  for (let i = 0; i < count; i++) {
    s = tick(s, TICK_MS, { requestedDirection: "none", pause: false }, rng);
  }
  return s;
}

describe("tick (state machine)", () => {
  it("transitions from ready to playing after the ready countdown", () => {
    const rng = createRng(1);
    const state = createInitialState(1);
    const readyTicks = Math.ceil(READY_DURATION_MS / TICK_MS) + 1;
    const after = runTicks(state, readyTicks, rng);
    expect(after.phase).toBe("playing");
  });

  it("is fully deterministic for a fixed seed and input sequence", () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    const a = runTicks(createInitialState(99), 300, rng1);
    const b = runTicks(createInitialState(99), 300, rng2);
    expect(a.mouse.position).toEqual(b.mouse.position);
    expect(a.ghosts.map((g) => g.position)).toEqual(b.ghosts.map((g) => g.position));
    expect(a.score).toBe(b.score);
  });

  it("toggles pause and resume on repeated pause input", () => {
    const rng = createRng(1);
    let state = createInitialState(1);
    state = runTicks(state, Math.ceil(READY_DURATION_MS / TICK_MS) + 1, rng);
    expect(state.phase).toBe("playing");

    const paused = tick(state, TICK_MS, { requestedDirection: "none", pause: true }, rng);
    expect(paused.phase).toBe("paused");

    const resumed = tick(paused, TICK_MS, { requestedDirection: "none", pause: true }, rng);
    expect(resumed.phase).toBe("playing");
  });

  it("does not advance the simulation while paused", () => {
    const rng = createRng(1);
    let state = createInitialState(1);
    state = runTicks(state, Math.ceil(READY_DURATION_MS / TICK_MS) + 1, rng);
    const paused = tick(state, TICK_MS, { requestedDirection: "none", pause: true }, rng);
    const stillPaused = tick(paused, TICK_MS, { requestedDirection: "right", pause: false }, rng);
    expect(stillPaused.elapsedMs).toBe(paused.elapsedMs);
    expect(stillPaused.mouse.position).toEqual(paused.mouse.position);
  });
});
