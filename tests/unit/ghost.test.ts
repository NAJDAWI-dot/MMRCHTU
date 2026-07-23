import { describe, expect, it } from "vitest";
import { computeChaseTarget, computeGlobalMode, updateGhost } from "@/game/engine/entities/ghost";
import { createMaze } from "@/game/engine/maze";
import { createRng } from "@/game/engine/rng";
import type { Ghost, Mouse } from "@/game/engine/types";

function baseGhost(overrides: Partial<Ghost> = {}): Ghost {
  return {
    name: "blinky",
    color: "#862633",
    position: { x: 9, y: 9 },
    direction: "up",
    mode: "chase",
    modeTimer: 0,
    speed: 5,
    scatterTarget: { x: 17, y: 1 },
    houseExitDelayMs: 0,
    ...overrides,
  };
}

function baseMouse(overrides: Partial<Mouse> = {}): Mouse {
  return {
    position: { x: 9, y: 15 },
    direction: "up",
    nextDirection: "none",
    speed: 5,
    lives: 3,
    ...overrides,
  };
}

describe("computeGlobalMode", () => {
  it("starts in scatter mode", () => {
    expect(computeGlobalMode(0)).toBe("scatter");
  });

  it("switches to chase after the first scatter phase (7s)", () => {
    expect(computeGlobalMode(7_001)).toBe("chase");
  });

  it("eventually settles into permanent chase", () => {
    expect(computeGlobalMode(10_000_000)).toBe("chase");
  });
});

describe("computeChaseTarget", () => {
  const mouse = baseMouse({ position: { x: 10, y: 10 }, direction: "right" });
  const blinkyPosition = { x: 5, y: 5 };

  it("blinky targets the mouse directly", () => {
    const blinky = baseGhost({ name: "blinky" });
    expect(computeChaseTarget(blinky, mouse, blinkyPosition)).toEqual({ x: 10, y: 10 });
  });

  it("pinky targets 4 tiles ahead of the mouse", () => {
    const pinky = baseGhost({ name: "pinky" });
    expect(computeChaseTarget(pinky, mouse, blinkyPosition)).toEqual({ x: 14, y: 10 });
  });

  it("inky targets a point mirrored through blinky", () => {
    const inky = baseGhost({ name: "inky" });
    // pivot = mouse + 2 ahead = (12, 10); target = 2*pivot - blinky = (24-5, 20-5)
    expect(computeChaseTarget(inky, mouse, blinkyPosition)).toEqual({ x: 19, y: 15 });
  });

  it("clyde chases when far and retreats to its scatter corner when close", () => {
    const farClyde = baseGhost({ name: "clyde", position: { x: 0, y: 0 }, scatterTarget: { x: 1, y: 1 } });
    expect(computeChaseTarget(farClyde, mouse, blinkyPosition)).toEqual(mouse.position);

    const nearClyde = baseGhost({ name: "clyde", position: { x: 10, y: 11 }, scatterTarget: { x: 1, y: 1 } });
    expect(computeChaseTarget(nearClyde, mouse, blinkyPosition)).toEqual({ x: 1, y: 1 });
  });
});

describe("updateGhost", () => {
  const maze = createMaze();
  const mouse = baseMouse();
  const rng = createRng(1);

  it("stays in the house until its exit delay elapses", () => {
    const ghost = baseGhost({ mode: "house", houseExitDelayMs: 5_000, position: { x: 9, y: 9 } });
    const stillWaiting = updateGhost(ghost, {
      maze,
      mouse,
      blinkyPosition: ghost.position,
      globalMode: "scatter",
      elapsedPlayMs: 1_000,
      frightened: false,
      rng,
      dtSeconds: 1 / 60,
    });
    expect(stillWaiting.mode).toBe("house");
    expect(stillWaiting.position).toEqual(ghost.position);
  });

  it("leaves the house once its exit delay has passed", () => {
    const ghost = baseGhost({ mode: "house", houseExitDelayMs: 1_000, position: { x: 9, y: 9 } });
    const released = updateGhost(ghost, {
      maze,
      mouse,
      blinkyPosition: ghost.position,
      globalMode: "scatter",
      elapsedPlayMs: 1_500,
      frightened: false,
      rng,
      dtSeconds: 1 / 60,
    });
    expect(released.mode).toBe("scatter");
  });

  it("adopts frightened mode when the frightened flag is set", () => {
    const ghost = baseGhost({ mode: "chase" });
    const next = updateGhost(ghost, {
      maze,
      mouse,
      blinkyPosition: ghost.position,
      globalMode: "chase",
      elapsedPlayMs: 10_000,
      frightened: true,
      rng,
      dtSeconds: 1 / 60,
    });
    expect(next.mode).toBe("frightened");
  });

  it("moves twice as fast while eaten, heading back toward the house", () => {
    // start away from the house center (9,9) so "eaten" doesn't instantly revive
    const start = { x: 3, y: 3 };
    const normalGhost = baseGhost({ mode: "chase", position: { ...start }, direction: "up" });
    const eatenGhost = baseGhost({ mode: "eaten", position: { ...start }, direction: "up" });

    const normalNext = updateGhost(normalGhost, {
      maze,
      mouse,
      blinkyPosition: normalGhost.position,
      globalMode: "chase",
      elapsedPlayMs: 10_000,
      frightened: false,
      rng,
      dtSeconds: 1 / 60,
    });
    const eatenNext = updateGhost(eatenGhost, {
      maze,
      mouse,
      blinkyPosition: eatenGhost.position,
      globalMode: "chase",
      elapsedPlayMs: 10_000,
      frightened: false,
      rng,
      dtSeconds: 1 / 60,
    });

    expect(eatenNext.mode).toBe("eaten");
    const normalDist = Math.hypot(normalNext.position.x - start.x, normalNext.position.y - start.y);
    const eatenDist = Math.hypot(eatenNext.position.x - start.x, eatenNext.position.y - start.y);
    expect(eatenDist).toBeCloseTo(normalDist * 2, 5);
  });
});
