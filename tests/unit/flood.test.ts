import { describe, expect, it } from "vitest";
import { floodDistances } from "@/lib/flood";
import { DIRS, generateMaze, seededRandom } from "@/lib/maze";

describe("floodDistances", () => {
  const maze = generateMaze(16, seededRandom(1626), 0.12);
  const flood = floodDistances(maze);
  const at = (x: number, y: number) => flood[y * 16 + x]!;

  it("puts the centre room at zero", () => {
    expect([at(7, 7), at(8, 7), at(7, 8), at(8, 8)]).toEqual([0, 0, 0, 0]);
  });

  it("reaches every cell of a carved maze", () => {
    expect(flood.every((d) => d >= 0)).toBe(true);
  });

  it("only ever steps by one through an open wall", () => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const here = at(x, y);
        if (here === 0) continue;
        // Some open neighbour is exactly one closer: the way a mouse walks home.
        const closer = DIRS.some((d) => {
          const nx = x + d.dx;
          const ny = y + d.dy;
          return nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && !maze.cells[y * 16 + x]![d.wall] && at(nx, ny) === here - 1;
        });
        expect(closer).toBe(true);
      }
    }
  });

  it("agrees with the solved route's length from its corner", () => {
    const route = maze.routes[0]!;
    const cx = Math.floor(route.start.x / 20);
    const cy = Math.floor(route.start.y / 20);
    // The route counts cells visited including the start; the flood counts moves into the room.
    expect(at(cx, cy)).toBeLessThanOrEqual(route.cells);
    expect(at(cx, cy)).toBeGreaterThan(0);
  });
});
