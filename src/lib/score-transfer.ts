import { FINAL_ROUND, PHASES, matchesInRound, phaseInfo } from "@/lib/bracket";
import { parseCsv } from "@/lib/csv";
import { parseClock } from "@/lib/day-slots";
import {
  checkLog,
  formatPoints,
  outcomeText,
  MAZE_CELLS,
  cellFromShort,
  parseCell,
  parseRunResult,
  parseRunTime,
  type RunEntry,
  type SheetProblem,
  type SheetResult,
} from "@/lib/score-sheet";

/**
 * Scores and match timings in and out as spreadsheets.
 *
 * Every file this writes can be read straight back: download it, fix it or
 * fill it in with Excel or Google Sheets, upload it. Pure, so the reading is
 * tested line by line; the scoring desk's actions do the database side.
 *
 *  - Scores: one row per run, marked successful or not, for qualifying and
 *    every knockout match. Importing replaces the sheet of each team (or match
 *    side) in the file and leaves everyone else alone.
 *  - Standings: the qualifying table, for reading only.
 *  - Timings: when each team runs in qualifying and when and where each
 *    knockout match is.
 */

export const SHEET_PROBLEMS: Record<SheetProblem, string> = {
  "bad-time": "One of the run times is not a time. Use seconds (25.41) or minutes and seconds (1:05.3).",
  "bad-cell": "One of the failed runs has a cell that is not a whole number from 1 to 99.",
  "too-long": "Those runs add up to more than the eight minute match. Check the times.",
};

export const SCORE_HEADERS = ["Phase", "Match", "Team ID", "Team", "Run", "Result", "Time (s)", "Cell reached", "Score", "Note"] as const;
export const STANDINGS_HEADERS = [
  "Rank",
  "Team ID",
  "Team",
  "Score",
  "Successful runs",
  "Failed runs",
  "Official time (s)",
  "Furthest cell (no successful run)",
  "Runs",
  "Top 32",
] as const;
export const TIMING_HEADERS = ["Phase", "Match", "Order", "Team ID", "Team", "Opponent", "Time", "Maze"] as const;

export interface TeamRef {
  id: string;
  name: string;
}

// ------------------------------------------------------------------ writing

/**
 * A sheet as score rows, one per run. A team with a sheet but no runs on it (a
 * score from before run times were kept) gets a single row with its score.
 */
export function scoreRows(phase: number, match: number | null, team: TeamRef, sheet: SheetResult, score: number | null, note = ""): unknown[][] {
  const head = [phaseInfo(phase).name, match ?? "", team.id, team.name];
  const points = score === null ? "" : formatPoints(score);
  if (!sheet.log.length) return [[...head, "", "", "", "", points, note]];
  return sheet.log.map((run, index) => [
    ...head,
    index + 1,
    run.ok ? "Success" : "Fail",
    run.time ?? "",
    run.cell ?? "",
    points,
    index === 0 ? note : "",
  ]);
}

export function standingsRow(
  row: { rank: number | null; teamId: string; name: string; best: number | null; runs: number; failed: number; official: number | null; remaining: number | null; qualified: boolean },
): unknown[] {
  return [
    row.rank ?? "",
    row.teamId,
    row.name,
    row.best === null ? "" : formatPoints(row.best),
    row.runs,
    row.failed,
    row.official ?? "",
    row.remaining === null ? "" : cellFromShort(row.remaining),
    outcomeText(row),
    row.qualified ? "yes" : "no",
  ];
}

// ------------------------------------------------------------------ reading

type Column = "phase" | "match" | "order" | "teamId" | "team" | "run" | "result" | "time" | "cell" | "short" | "note" | "maze";

const HEADER_NAMES: Record<string, Column> = {
  phase: "phase",
  round: "phase",
  stage: "phase",
  match: "match",
  "match number": "match",
  order: "order",
  "running order": "order",
  place: "order",
  "team id": "teamId",
  id: "teamId",
  team: "team",
  "team name": "team",
  run: "run",
  "run number": "run",
  result: "result",
  successful: "result",
  success: "result",
  "reached the centre": "result",
  "reached centre": "result",
  time: "time",
  "run time": "time",
  seconds: "time",
  slot: "time",
  "start time": "time",
  starts: "time",
  "cell reached": "cell",
  cell: "cell",
  "cell number": "cell",
  "cell no": "cell",
  "reached cell": "cell",
  // Files from before cells were written down as a number.
  "cells short": "short",
  "distance short": "short",
  note: "note",
  maze: "maze",
  arena: "maze",
};

/** "Time (s)" and "Cell reached:" both read as their plain names. */
function columnOf(header: string): Column | null {
  const key = header
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return HEADER_NAMES[key] ?? null;
}

/** Qualifying is 1, the round of 32 is 2, up to the final at 6; "Round of 16", "QF", "Phase 3" and "3" all read. */
export function parsePhase(value: string): number | null {
  const raw = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return null;
  const number = /^(?:phase |round )?(\d)$/.exec(raw);
  if (number) {
    const phase = Number(number[1]);
    return phase >= 1 && phase <= FINAL_ROUND ? phase : null;
  }
  const clean = raw.replace(/-/g, " ").replace(/s$/, "");
  for (const info of PHASES) {
    const name = info.name.toLowerCase().replace(/-/g, " ").replace(/s$/, "");
    if (clean === name || raw === info.short.toLowerCase()) return info.phase;
  }
  if (raw === "qualifiers" || raw === "qualifier") return 1;
  return null;
}

const squash = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Finds the team a row is about: by its ID when the file has one, else by its exact name. */
function teamFinder(teams: TeamRef[]) {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const byName = new Map<string, TeamRef[]>();
  for (const team of teams) byName.set(squash(team.name), [...(byName.get(squash(team.name)) ?? []), team]);
  return (id: string, name: string): TeamRef | string => {
    const found = id.trim() ? byId.get(id.trim()) : undefined;
    if (found) return found;
    if (!name.trim()) return id.trim() ? `there is no team with the ID "${id.trim()}"` : "the row has no team";
    const named = byName.get(squash(name)) ?? [];
    if (named.length === 1) return named[0]!;
    if (named.length > 1) return `more than one team is called "${name.trim()}"; add the Team ID column from an export`;
    return `there is no confirmed team called "${name.trim()}"`;
  };
}

interface Table {
  rows: { line: number; get: (column: Column) => string }[];
  has: (column: Column) => boolean;
}

function readTable(text: string): Table | string {
  const grid = parseCsv(text);
  if (grid.length === 0) return "The file is empty.";
  const header = grid[0]!.map(columnOf);
  if (!header.some(Boolean)) return "The first line should be the column names, like the ones in an export.";
  const index = new Map<Column, number>();
  header.forEach((column, i) => {
    if (column && !index.has(column)) index.set(column, i);
  });
  return {
    has: (column) => index.has(column),
    rows: grid.slice(1).map((cells, i) => ({
      line: i + 2,
      get: (column: Column) => {
        const at = index.get(column);
        return at === undefined ? "" : (cells[at] ?? "").trim();
      },
    })),
  };
}

/** Enough problems to fix in one go, without a wall of them. */
const MAX_ERRORS = 8;

export interface QualifyingSheetImport {
  team: TeamRef;
  log: RunEntry[];
  /** Null when the file has no Note column, so the sheet keeps the note it has. */
  note: string | null;
  line: number;
}

export interface KnockoutSideImport {
  round: number;
  slot: number;
  team: TeamRef;
  log: RunEntry[];
  line: number;
}

export type ScoreImport =
  | { ok: false; errors: string[] }
  | { ok: true; qualifying: QualifyingSheetImport[]; knockout: KnockoutSideImport[]; runs: number };

/**
 * A scores file, read and checked in full. Any problem refuses the whole file,
 * with the line it is on, so nothing half-imports.
 *
 * A row with no result, time or distance is skipped: that is how an export
 * lists a team with no runs. A row with no result but a time is a successful
 * run; one with only a distance is a failed one.
 */
export function readScoreFile(text: string, teams: TeamRef[]): ScoreImport {
  const table = readTable(text);
  if (typeof table === "string") return { ok: false, errors: [table] };
  if (!table.has("team") && !table.has("teamId")) return { ok: false, errors: ["The file needs a Team or Team ID column."] };
  if (!table.has("result") && !table.has("time")) return { ok: false, errors: ["The file needs a Result or Time column."] };

  const find = teamFinder(teams);
  const errors: string[] = [];
  type Group = { round: number; slot: number; team: TeamRef; runs: { order: number; line: number; run: RunEntry }[]; note: string; line: number };
  const groups = new Map<string, Group>();

  for (const row of table.rows) {
    if (errors.length >= MAX_ERRORS) break;
    const fail = (why: string) => errors.push(`Line ${row.line}: ${why}.`);
    const resultText = row.get("result");
    const timeText = row.get("time");
    // The cell reached, or on an older file the cells short of the centre.
    const cellText = row.get("cell");
    const shortText = cellText ? "" : row.get("short");
    const noteText = row.get("note");
    if (!resultText && !timeText && !cellText && !shortText && !noteText) continue;

    const phaseText = row.get("phase");
    const round = phaseText ? parsePhase(phaseText) : 1;
    if (round === null) {
      fail(`"${phaseText}" is not a phase. Use Qualifying, Round of 32, Round of 16, Quarter-finals, Semi-finals or Final`);
      continue;
    }
    let slot = -1;
    if (round > 1) {
      const match = Number(row.get("match"));
      if (!Number.isInteger(match) || match < 1 || match > matchesInRound(round)) {
        fail(`${phaseInfo(round).name} needs a match number from 1 to ${matchesInRound(round)}`);
        continue;
      }
      slot = match - 1;
    }
    const team = find(row.get("teamId"), row.get("team"));
    if (typeof team === "string") {
      fail(team);
      continue;
    }

    const key = `${round}:${slot}:${team.id}`;
    const group = groups.get(key) ?? { round, slot, team, runs: [], note: "", line: row.line };
    groups.set(key, group);
    if (noteText && !group.note) group.note = noteText.slice(0, 200);
    if (!resultText && !timeText && !cellText && !shortText) continue;

    // No result written: a time means it reached the centre, a cell means it did not.
    const result = resultText ? parseRunResult(resultText) : !!timeText && !cellText && !shortText;
    if (result === null) {
      fail(`"${resultText}" is not a result. Use Success or Fail`);
      continue;
    }
    let run: RunEntry;
    if (result) {
      const time = timeText ? parseRunTime(timeText) : null;
      if (timeText && time === null) {
        fail(`"${timeText}" is not a run time. Use seconds, like 25.41, inside the 8 minutes`);
        continue;
      }
      if (time === null) {
        fail("a successful run needs its time");
        continue;
      }
      run = { ok: true, time, cell: null };
    } else {
      const short = shortText ? parseCell(shortText) : null;
      const cell = cellText ? parseCell(cellText) : short !== null ? cellFromShort(short) : null;
      if ((cellText || shortText) && cell === null) {
        fail(`"${cellText || shortText}" is not a cell. A failed run reached a cell from 1 to ${MAZE_CELLS - 1}`);
        continue;
      }
      run = { ok: false, time: null, cell };
    }
    const order = Number(row.get("run"));
    group.runs.push({ order: Number.isFinite(order) && row.get("run") ? order : Number.MAX_SAFE_INTEGER, line: row.line, run });
  }

  const qualifying: QualifyingSheetImport[] = [];
  const knockout: KnockoutSideImport[] = [];
  let runs = 0;
  for (const group of groups.values()) {
    const log = [...group.runs].sort((a, b) => a.order - b.order || a.line - b.line).map((entry) => entry.run);
    const problem = checkLog(log);
    if (problem) {
      if (errors.length < MAX_ERRORS) errors.push(`Line ${group.line}: ${group.team.name}. ${SHEET_PROBLEMS[problem]}`);
      continue;
    }
    if (!log.length) continue;
    runs += log.length;
    if (group.round === 1) {
      qualifying.push({ team: group.team, log, note: table.has("note") ? group.note : null, line: group.line });
    } else {
      knockout.push({ round: group.round, slot: group.slot, team: group.team, log, line: group.line });
    }
  }

  if (errors.length) return { ok: false, errors };
  if (!qualifying.length && !knockout.length) return { ok: false, errors: ["The file has no runs in it."] };
  return { ok: true, qualifying, knockout, runs };
}

export interface QualifyingTimingImport {
  team: TeamRef;
  /** The team's place in the running order, or null to take it out of the order. */
  order: number | null;
  /** "09:40", or "" to work the time out from the order. */
  time: string;
  line: number;
}

export interface KnockoutTimingImport {
  round: number;
  slot: number;
  /** "14:20", or "" for no start time. */
  time: string;
  maze: string;
  line: number;
}

export type TimingImport =
  | { ok: false; errors: string[] }
  | { ok: true; qualifying: QualifyingTimingImport[]; knockout: KnockoutTimingImport[] };

/**
 * A timings file, read and checked in full. Each qualifying row sets that
 * team's place and slot time; each knockout row sets that match's start time
 * and maze. A blank cell clears the value, so the file says exactly what each
 * row ends up as.
 */
export function readTimingFile(text: string, teams: TeamRef[]): TimingImport {
  const table = readTable(text);
  if (typeof table === "string") return { ok: false, errors: [table] };
  if (!table.has("time") && !table.has("order") && !table.has("maze")) {
    return { ok: false, errors: ["The file needs a Time, Order or Maze column."] };
  }

  const find = teamFinder(teams);
  const errors: string[] = [];
  const qualifying: QualifyingTimingImport[] = [];
  const knockout: KnockoutTimingImport[] = [];
  const seenTeams = new Map<string, number>();
  const seenOrders = new Map<number, number>();
  const seenMatches = new Map<string, number>();

  for (const row of table.rows) {
    if (errors.length >= MAX_ERRORS) break;
    const fail = (why: string) => errors.push(`Line ${row.line}: ${why}.`);
    const phaseText = row.get("phase");
    const round = phaseText ? parsePhase(phaseText) : 1;
    if (round === null) {
      fail(`"${phaseText}" is not a phase. Use Qualifying, Round of 32, Round of 16, Quarter-finals, Semi-finals or Final`);
      continue;
    }
    const timeText = row.get("time");
    const time = timeText ? parseClock(timeText) : "";
    if (time === null) {
      fail(`"${timeText}" is not a time. Use 24-hour time, like 09:40`);
      continue;
    }

    if (round === 1) {
      const team = find(row.get("teamId"), row.get("team"));
      if (typeof team === "string") {
        fail(team);
        continue;
      }
      const orderText = row.get("order");
      const order = orderText ? Number(orderText) : null;
      if (order !== null && (!Number.isInteger(order) || order < 1 || order > 999)) {
        fail(`"${orderText}" is not a place in the running order`);
        continue;
      }
      if (seenTeams.has(team.id)) {
        fail(`${team.name} is already on line ${seenTeams.get(team.id)}`);
        continue;
      }
      if (order !== null && seenOrders.has(order)) {
        fail(`place ${order} is already given to line ${seenOrders.get(order)}`);
        continue;
      }
      seenTeams.set(team.id, row.line);
      if (order !== null) seenOrders.set(order, row.line);
      qualifying.push({ team, order, time, line: row.line });
    } else {
      const match = Number(row.get("match"));
      if (!Number.isInteger(match) || match < 1 || match > matchesInRound(round)) {
        fail(`${phaseInfo(round).name} needs a match number from 1 to ${matchesInRound(round)}`);
        continue;
      }
      const key = `${round}:${match}`;
      if (seenMatches.has(key)) {
        fail(`${phaseInfo(round).name} match ${match} is already on line ${seenMatches.get(key)}`);
        continue;
      }
      seenMatches.set(key, row.line);
      knockout.push({ round, slot: match - 1, time, maze: row.get("maze").slice(0, 60), line: row.line });
    }
  }

  if (errors.length) return { ok: false, errors };
  if (!qualifying.length && !knockout.length) return { ok: false, errors: ["The file has no rows in it."] };
  return { ok: true, qualifying, knockout };
}

/** "mmrc26-scores-2026-03-14.csv" */
export function transferFileName(kind: "scores" | "standings" | "timings", day: string): string {
  return `mmrc26-${kind}-${day}.csv`;
}
