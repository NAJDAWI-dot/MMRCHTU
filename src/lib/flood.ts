import { DIRS, type Maze } from "@/lib/maze";

/**
 * Flood fill, the way a micromouse solves a maze: every cell's distance, in
 * moves, from the centre room, walking only through open walls. The goal's
 * four cells are 0, their open neighbours 1, and so on outwards. A mouse that
 * always steps to a lower number reaches the centre by a shortest route.
 *
 * Row-major, like `maze.cells`. A cell the flood cannot reach (a maze with a
 * closed-off pocket) is -1.
 */
export function floodDistances(maze: Maze): number[] {
  const size = maze.size;
  const distances = new Array<number>(size * size).fill(-1);
  const g = size / 2 - 1;
  const queue: [number, number][] = [];
  for (const [x, y] of [
    [g, g],
    [g + 1, g],
    [g, g + 1],
    [g + 1, g + 1],
  ] as const) {
    distances[y * size + x] = 0;
    queue.push([x, y]);
  }
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head]!;
    const here = distances[y * size + x]!;
    const walls = maze.cells[y * size + x]!;
    for (const d of DIRS) {
      if (walls[d.wall]) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (distances[ny * size + nx] !== -1) continue;
      distances[ny * size + nx] = here + 1;
      queue.push([nx, ny]);
    }
  }
  return distances;
}
