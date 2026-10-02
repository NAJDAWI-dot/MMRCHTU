/**
 * The mazes on the floor, and which one each team runs on.
 *
 * Qualifying puts each team on a maze for its eight minutes; in the knockout
 * the two mice race side by side, one maze each. The names are whatever the
 * organisers call them ("Maze A", "Left table"), kept in
 * CompetitionDayConfig.mazeNames, and a team's maze is stored as that name.
 *
 * Free of Prisma and of Next so it can be tested on its own.
 */

/** Long enough for "Maze A (by the stage)", short enough for a chip. */
export const MAZE_NAME_MAX = 40;

/** More than any hall has room for. */
export const MAZES_MAX = 12;

/** A maze name as it will be stored: one line, trimmed, capped. "" for none. */
export function cleanMaze(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAZE_NAME_MAX)
    .trim();
}

/** "Maze A,Maze B" (or one per line) to ["Maze A", "Maze B"], each once. */
export function parseMazeNames(value: unknown): string[] {
  const names: string[] = [];
  for (const part of String(value ?? "").split(/[,\n]/)) {
    const name = cleanMaze(part);
    if (name && !names.some((item) => item.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return names.slice(0, MAZES_MAX);
}

export function serializeMazeNames(names: readonly string[]): string {
  return parseMazeNames(names.join(",")).join(",");
}

/**
 * The mazes in turn: the first team on the first maze, the second on the
 * second, and round again. What "Share them out" does on the Mazes desk.
 */
export function shareOut(ids: readonly string[], mazes: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!mazes.length) return out;
  ids.forEach((id, index) => out.set(id, mazes[index % mazes.length]!));
  return out;
}

/** The maze one team runs on in a match, or "" when nobody has said. */
export function sideMaze(match: { teamAId: string | null; teamBId: string | null; mazeA?: string; mazeB?: string }, teamId: string): string {
  if (match.teamAId === teamId) return match.mazeA ?? "";
  if (match.teamBId === teamId) return match.mazeB ?? "";
  return "";
}
