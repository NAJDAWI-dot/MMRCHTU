import { parseMazeNames } from "@/lib/mazes";
import { nameKey } from "@/lib/team-codes";

/**
 * A qualifying draw made by hand, pasted from the organisers' sheet: one row
 * per time slot, one column per maze, a team in each cell.
 *
 *   time slot   Maze B2 orange Village   Maze B1 new soft area
 *   11:30:00    A3 - HyperMind           C8 - Tom & Jerry
 *
 * The heading row names the mazes. Each team gets the row's time as its own
 * slot time and the column's maze as its qualifying maze; the running order
 * is read row by row, left to right, so the teams of one row are one call.
 * A team is found by its code, or by its name when the cell has no code.
 *
 * Free of Prisma and of Next so it can be tested on its own.
 */

/** A team code: a letter and one or two digits, A0, G2, T07. */
const CODE = /^[A-Za-z]\d{1,2}$/;

export interface DrawTeam {
  id: string;
  name: string;
  code: string;
}

export interface DrawCell {
  teamId: string;
  name: string;
  code: string;
  order: number;
}

export interface CustomDraw {
  /** The maze names from the heading row, or empty when the paste has none. */
  mazes: string[];
  rows: { time: string; cells: (DrawCell | null)[] }[];
  problems: string[];
  /** Teams given a place. */
  placed: number;
  /** Teams in the list not in the draw, who would be left without a slot. */
  missing: DrawTeam[];
}

/** "11:30:00", "11:30" or "9.30" to "11:30"; null for anything else. */
export function slotClock(value: string): string | null {
  const match = /^(\d{1,2})[:.](\d{2})(?::\d{2})?(\s*[ap]\.?m\.?)?$/i.exec(value.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const half = match[3]?.trim().toLowerCase().replace(/\./g, "");
  if (half === "pm" && hours < 12) hours += 12;
  if (half === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * A cell's code and name: "A3 - HyperMind", or "جردون بلو - F5" with the code
 * last. Only a code at either end counts, since names have dashes of their
 * own ("Aura - X", "R&D-spectrum").
 */
export function readCell(cell: string): { code: string; name: string } {
  const text = cell.trim();
  const first = /^([A-Za-z]\d{1,2})\s*[-–—]\s*(.+)$/.exec(text);
  if (first) return { code: first[1]!.toUpperCase(), name: first[2]!.trim() };
  const last = /^(.+?)\s*[-–—]\s*([A-Za-z]\d{1,2})$/.exec(text);
  if (last) return { code: last[2]!.toUpperCase(), name: last[1]!.trim() };
  if (CODE.test(text)) return { code: text.toUpperCase(), name: "" };
  return { code: "", name: text };
}

/** Reads a pasted sheet against the confirmed teams. */
export function readCustomDraw(paste: string, teams: readonly DrawTeam[]): CustomDraw {
  const byCode = new Map(teams.filter((team) => team.code).map((team) => [team.code.toUpperCase(), team]));
  const byName = new Map<string, DrawTeam[]>();
  for (const team of teams) {
    const key = nameKey(team.name);
    if (key) byName.set(key, [...(byName.get(key) ?? []), team]);
  }

  const draw: CustomDraw = { mazes: [], rows: [], problems: [], placed: 0, missing: [] };
  const seen = new Map<string, string>();
  let order = 0;

  const lines = paste.split(/\r?\n/).filter((line) => line.trim());
  for (const [index, line] of lines.entries()) {
    const cells = line.split("\t").map((cell) => cell.trim());
    const time = slotClock(cells[0] ?? "");
    if (time === null) {
      // The heading row, before any slot: the mazes, column by column.
      if (!draw.rows.length && !draw.mazes.length && cells.length > 1) draw.mazes = parseMazeNames(cells.slice(1).join(","));
      else draw.problems.push(`Line ${index + 1}: "${cells[0]}" is not a time.`);
      continue;
    }
    const row: { time: string; cells: (DrawCell | null)[] } = { time, cells: [] };
    for (const text of cells.slice(1)) {
      if (!text) {
        row.cells.push(null);
        continue;
      }
      const { code, name } = readCell(text);
      const named = byName.get(nameKey(name)) ?? [];
      const team = (code && byCode.get(code)) || (named.length === 1 ? named[0] : undefined);
      if (!team) {
        draw.problems.push(`${time}: no team has the code ${code || "(none)"}${name ? ` or the name ${name}` : ""}.`);
        row.cells.push(null);
        continue;
      }
      if (seen.has(team.id)) {
        draw.problems.push(`${time}: ${team.name} is already at ${seen.get(team.id)}.`);
        row.cells.push(null);
        continue;
      }
      seen.set(team.id, time);
      order += 1;
      row.cells.push({ teamId: team.id, name: team.name, code: team.code, order });
    }
    draw.rows.push(row);
  }

  draw.placed = order;
  draw.missing = teams.filter((team) => !seen.has(team.id));
  return draw;
}

/** The slot length the sheet uses: the gap between its first two times, else 10. */
export function slotMinutesOf(draw: CustomDraw): number {
  const times = [...new Set(draw.rows.map((row) => row.time))];
  if (times.length < 2) return 10;
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const gap = minutes(times[1]!) - minutes(times[0]!);
  return gap >= 1 && gap <= 60 ? gap : 10;
}
