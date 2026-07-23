import { describe, expect, it } from "vitest";
import { updateMouse } from "@/game/engine/entities/mouse";
import { createMaze, TUNNEL_ROW } from "@/game/engine/maze";
import type { Mouse } from "@/game/engine/types";

function baseMouse(overrides: Partial<Mouse> = {}): Mouse {
  return {
    position: { x: 9, y: 15 },
    direction: "none",
    nextDirection: "none",
    speed: 5,
    lives: 3,
    ...overrides,
  };
}

describe("updateMouse", () => {
  it("starts moving once a legal direction is requested at a grid-aligned tile", () => {
    const maze = createMaze();
    const mouse = baseMouse();
    const next = updateMouse(mouse, maze, 1 / 60, "right");
    expect(next.direction).toBe("right");
    expect(next.position.x).toBeGreaterThan(mouse.position.x);
  });

  it("buffers a request blocked by a wall, keeping the current walkable direction", () => {
    const maze = createMaze();
    // (2,2) is a lattice wall pillar; (1,2) is corridor with a clear path "up".
    const mouse = baseMouse({ position: { x: 1, y: 2 }, direction: "up" });
    const next = updateMouse(mouse, maze, 1 / 60, "right");
    expect(next.direction).toBe("up");
    expect(next.nextDirection).toBe("right");
  });

  it("buffers a requested direction until the next grid-aligned tile", () => {
    const maze = createMaze();
    const mouse = baseMouse({ position: { x: 9.4, y: 15 }, direction: "right" });
    const next = updateMouse(mouse, maze, 1 / 60, "up");
    expect(next.direction).toBe("right");
    expect(next.nextDirection).toBe("up");
  });

  it("wraps around the tunnel row", () => {
    const maze = createMaze();
    const mouse = baseMouse({ position: { x: 0, y: TUNNEL_ROW }, direction: "left" });
    const next = updateMouse(mouse, maze, 1, "left"); // 1s at speed 5 forces a wrap
    expect(next.position.x).toBeGreaterThan(0);
  });

  it("stops when the current direction becomes blocked and nothing is buffered", () => {
    const maze = createMaze();
    // moving "right" from (1,2) would hit the wall pillar at (2,2).
    const mouse = baseMouse({ position: { x: 1, y: 2 }, direction: "right" });
    const next = updateMouse(mouse, maze, 1 / 60, "none");
    expect(next.direction).toBe("none");
    expect(next.position).toEqual({ x: 1, y: 2 });
  });
});
