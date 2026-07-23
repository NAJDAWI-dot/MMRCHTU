import { describe, expect, it } from "vitest";
import { applyPelletPickup, resolveGhostCollisions } from "@/game/engine/collision";
import { createMaze } from "@/game/engine/maze";
import type { Ghost, Mouse } from "@/game/engine/types";

function baseMouse(overrides: Partial<Mouse> = {}): Mouse {
  return {
    position: { x: 1, y: 1 },
    direction: "none",
    nextDirection: "none",
    speed: 5,
    lives: 3,
    ...overrides,
  };
}

function baseGhost(overrides: Partial<Ghost> = {}): Ghost {
  return {
    name: "blinky",
    color: "#862633",
    position: { x: 1, y: 1 },
    direction: "up",
    mode: "chase",
    modeTimer: 0,
    speed: 5,
    scatterTarget: { x: 17, y: 1 },
    houseExitDelayMs: 0,
    ...overrides,
  };
}

describe("applyPelletPickup", () => {
  it("removes a power pellet exactly once and awards its point value", () => {
    const maze = createMaze();
    const mouse = baseMouse({ position: { x: 1, y: 1 } }); // corner power pellet

    const first = applyPelletPickup(maze, mouse);
    expect(first.powerPelletEaten).toBe(true);
    expect(first.scoreDelta).toBe(50);
    expect(first.maze.pelletsRemaining).toBe(maze.pelletsRemaining - 1);

    const second = applyPelletPickup(first.maze, mouse);
    expect(second.scoreDelta).toBe(0);
    expect(second.powerPelletEaten).toBe(false);
  });

  it("does nothing when the mouse isn't grid-aligned", () => {
    const maze = createMaze();
    const mouse = baseMouse({ position: { x: 1.5, y: 1 } });
    const result = applyPelletPickup(maze, mouse);
    expect(result.scoreDelta).toBe(0);
    expect(result.maze).toBe(maze);
  });

  it("awards a regular pellet's point value", () => {
    const maze = createMaze();
    const mouse = baseMouse({ position: { x: 1, y: 2 } }); // plain corridor pellet
    const result = applyPelletPickup(maze, mouse);
    expect(result.scoreDelta).toBe(10);
  });
});

describe("resolveGhostCollisions", () => {
  it("costs a life when touching a non-frightened ghost", () => {
    const mouse = baseMouse({ position: { x: 5, y: 5 } });
    const ghost = baseGhost({ position: { x: 5, y: 5 }, mode: "chase" });
    const result = resolveGhostCollisions(mouse, [ghost], 0);
    expect(result.lifeLost).toBe(true);
    expect(result.scoreDelta).toBe(0);
  });

  it("eats a frightened ghost and awards escalating chain bonuses", () => {
    const mouse = baseMouse({ position: { x: 5, y: 5 } });
    const ghost = baseGhost({ position: { x: 5, y: 5 }, mode: "frightened" });

    const first = resolveGhostCollisions(mouse, [ghost], 0);
    expect(first.lifeLost).toBe(false);
    expect(first.scoreDelta).toBe(200);
    expect(first.ghosts[0]?.mode).toBe("eaten");
    expect(first.ghostChain).toBe(1);

    const secondGhost = baseGhost({ position: { x: 5, y: 5 }, mode: "frightened" });
    const second = resolveGhostCollisions(mouse, [secondGhost], first.ghostChain);
    expect(second.scoreDelta).toBe(400);
  });

  it("ignores ghosts that are far away", () => {
    const mouse = baseMouse({ position: { x: 5, y: 5 } });
    const ghost = baseGhost({ position: { x: 15, y: 15 }, mode: "chase" });
    const result = resolveGhostCollisions(mouse, [ghost], 0);
    expect(result.lifeLost).toBe(false);
  });

  it("ignores ghosts that are eaten or still in the house", () => {
    const mouse = baseMouse({ position: { x: 5, y: 5 } });
    const eaten = baseGhost({ position: { x: 5, y: 5 }, mode: "eaten" });
    const inHouse = baseGhost({ position: { x: 5, y: 5 }, mode: "house" });
    const result = resolveGhostCollisions(mouse, [eaten, inHouse], 0);
    expect(result.lifeLost).toBe(false);
    expect(result.scoreDelta).toBe(0);
  });
});
