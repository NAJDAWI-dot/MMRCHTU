import { describe, expect, it } from "vitest";
import { DIRS, generateMaze, seededRandom } from "@/lib/maze";
import { CORNERS, cornerCell, cornerExits, floodFill, floodRoute, placeStart, wallFollow } from "@/lib/micromouse";
import { DIAGRAM_BRAID, RULES, goalCells } from "@/lib/rules";

const wallsOf = (maze: ReturnType<typeof generateMaze>, x: number, y: number) => maze.cells[y * maze.size + x]!;
const goalWalls = (maze: ReturnType<typeof generateMaze>) => goalCells(maze).map((c) => [...wallsOf(maze, c.x, c.y)]);

describe("placeStart", () => {
  it("knows the corners and their two ways out", () => {
    const maze = generateMaze(10, seededRandom(1));
    expect(cornerCell(maze, "bottom-left")).toEqual({ x: 0, y: 9 });
    expect(cornerCell(maze, "top-right")).toEqual({ x: 9, y: 0 });
    expect(cornerExits("bottom-left")).toEqual([0, 1]);
    expect(cornerExits("top-right")).toEqual([2, 3]);
  });

  it("leaves every corner with walls on three sides, every cell reachable and the goal room alone", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const base = generateMaze(RULES.mazeGrid, seededRandom(seed), DIAGRAM_BRAID);
      for (const corner of CORNERS) {
        for (const heading of [undefined, ...cornerExits(corner)]) {
          const { maze, start } = placeStart(base, corner, heading);
          const walls = wallsOf(maze, start.cell.x, start.cell.y);
          expect(walls.filter(Boolean)).toHaveLength(3);
          expect(walls[DIRS[start.heading]!.wall]).toBe(false);
          if (heading !== undefined) expect(start.heading).toBe(heading);
          expect(floodFill(maze).flat().every(Number.isFinite)).toBe(true);
          expect(goalWalls(maze)).toEqual(goalWalls(base));
          // Every wall is stored the same on both sides.
          let mismatched = 0;
          for (let y = 0; y < maze.size; y++) {
            for (let x = 0; x < maze.size; x++) {
              for (const d of DIRS) {
                const nx = x + d.dx;
                const ny = y + d.dy;
                if (nx < 0 || ny < 0 || nx >= maze.size || ny >= maze.size) continue;
                if (wallsOf(maze, x, y)[d.wall] !== wallsOf(maze, nx, ny)[d.opp]) mismatched++;
              }
            }
          }
          expect(mismatched).toBe(0);
        }
      }
    }
  });

  it("keeps the way out a corner already has", () => {
    const base = generateMaze(RULES.mazeGrid, seededRandom(7));
    const { maze, start } = placeStart(base, "bottom-left");
    // The generator carves from the bottom-left corner, which has one way out already.
    expect(maze.cells).toEqual(base.cells);
    expect(start.cell).toEqual({ x: 0, y: 9 });
  });

  it("renumbers from the new start: the route starts there and ends in the centre", () => {
    const base = generateMaze(RULES.mazeGrid, seededRandom(3), DIAGRAM_BRAID);
    const { maze, start } = placeStart(base, "top-right");
    const distances = floodFill(maze);
    const route = floodRoute(maze, distances, start.cell);
    expect(route[0]).toEqual({ x: 9, y: 0 });
    expect(distances[route.at(-1)!.y]![route.at(-1)!.x]).toBe(0);
    expect(route).toHaveLength(distances[0]![9]! + 1);
    // The first move leaves through the one open side.
    expect({ x: route[1]!.x - 9, y: route[1]!.y }).toEqual({ x: DIRS[start.heading]!.dx, y: DIRS[start.heading]!.dy });
  });

  it("starts the wall follower in the new corner, facing out", () => {
    const base = generateMaze(RULES.mazeGrid, seededRandom(5), DIAGRAM_BRAID);
    const { maze, start } = placeStart(base, "top-left", 1);
    const hand = wallFollow(maze, "left", 50, start);
    expect(hand.path[0]).toEqual({ x: 0, y: 0 });
    expect(hand.path[1]).toEqual({ x: 1, y: 0 });
  });
});

describe("mazeImageSvg", () => {
  it("draws every number, the walls, the goal and a caption naming the start", async () => {
    const { mazeImageSvg, startArrow } = await import("@/lib/maze-image");
    const base = generateMaze(RULES.mazeGrid, seededRandom(11), DIAGRAM_BRAID);
    const { maze, start } = placeStart(base, "top-right", 2);
    const distances = floodFill(maze);
    const { svg, width, height } = mazeImageSvg({ maze, distances, start, corner: "top-right", show: "numbers" });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(width).toBe(2240);
    expect(height).toBeGreaterThan(width);
    expect(svg.match(/<text /g)).toHaveLength(maze.size * maze.size + 1);
    expect(svg).toContain("Start top-right, facing down");
    expect(svg).toContain('fill="#f2a900"');
    expect(svg).not.toContain("class=");
    // The arrow points down out of the top-right cell, at its lower edge, clear of the number.
    expect(startArrow(start).startsWith("M190 19")).toBe(true);
  });

  it("draws the route instead of the numbers when the lab shows the route", async () => {
    const { mazeImageSvg } = await import("@/lib/maze-image");
    const base = generateMaze(RULES.mazeGrid, seededRandom(12), DIAGRAM_BRAID);
    const { maze, start } = placeStart(base, "bottom-right");
    const distances = floodFill(maze);
    const route = floodRoute(maze, distances, start.cell);
    const { svg } = mazeImageSvg({ maze, distances, start, corner: "bottom-right", show: "route", route });
    expect(svg.match(/<text /g)).toHaveLength(1);
    expect(svg).toContain('stroke="#862633" stroke-width="3.2"');
  });
});
