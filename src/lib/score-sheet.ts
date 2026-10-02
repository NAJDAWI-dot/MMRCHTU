import { RULES, finalScore } from "@/lib/rules";

/**
 * A match sheet: what a judge writes down about one team's eight minutes.
 *
 * The rulebook (version 3) scores both phases the same way:
 *
 *     final score = ((successful runs + 1.5 * successful returns) / official time) * 1000
 *
 * where the official time is the team's fastest successful run or return. A
 * return is the mouse driving itself back from the centre to the start, and it
 * can only come straight after a run that reached the centre. The desk
 * writes down every run, successful or not: a time for each one that reached
 * the centre, and for one that did not, the cell it got to. Every maze has 100
 * cells and the centre is the 100th, so a failed run reached cell 1 to 99. The
 * score, the run count and the official time all come out of this file. Failed
 * runs add nothing to the score, so a team with some of each is scored on its
 * successful ones alone. A mouse that never reached the centre has no score at
 * all; the rulebook ranks those by how far short of the centre they stopped,
 * so the furthest cell first, and below every mouse that did.
 *
 * Pure: the scoring desk, the public pages and the tests all use it.
 */

/** The whole match, in seconds. No run, and no set of runs, can be longer. */
export const MATCH_SECONDS = RULES.matchMinutes * 60;

/** Cells in every maze, counted to the centre: reaching cell 100 is reaching the centre. */
export const MAZE_CELLS = 100;

/**
 * One run, as the judge wrote it down. A successful run has its time; a failed
 * one has the cell it reached, 1 to 99, when that was written down.
 */
export interface RunEntry {
  ok: boolean;
  time: number | null;
  cell: number | null;
  /**
   * A return, centre back to start, rather than a run. Only present when true,
   * so every log written before returns existed reads exactly as it did. A
   * return has a time when it made it back and nothing when it did not.
   */
  ret?: true;
}

export interface SheetInput {
  /** Seconds, one per run that reached the centre, in the order they were run. */
  times: number[];
  /** Cells short of the centre (100 less the cell reached), for a mouse with no successful run. */
  remaining: number | null;
  /**
   * Every run in order, successful or not. When it has any, `times` and
   * `remaining` are worked out from it instead; sheets written before failed
   * runs were recorded have an empty log.
   */
  log?: unknown;
}

export interface SheetResult {
  /** The successful runs' times, in the order they were run. */
  times: number[];
  /**
   * The fewest cells short of the centre (100 less the furthest cell reached),
   * for a mouse with no successful run. What the ranking compares.
   */
  remaining: number | null;
  /** Every run, in order. */
  log: RunEntry[];
  /** Successful runs: how many times there are. */
  runs: number;
  /** Runs that did not reach the centre. Returns are not counted here. */
  failed: number;
  /** Successful returns that count: each straight after a successful run. */
  returns: number;
  /** Those returns' times, in the order they were made. */
  returnTimes: number[];
  /** Returns that did not make it back to the start. */
  failedReturns: number;
  /** The fastest run or return, or null with no successful run. */
  official: number | null;
  /** The formula's result, or null with no successful run. */
  score: number | null;
}

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const isCells = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAZE_CELLS;
const isCell = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAZE_CELLS;

/** The cell a mouse got to, from how many cells short of the centre it stopped. */
export const cellFromShort = (short: number): number => MAZE_CELLS - short;

/**
 * A log as stored (JSON, so anything) made safe: entries that are not runs are
 * dropped, and a "successful" run with no time is not one. A failed run from
 * before cells were written down as a cell number (it had `short`, cells short
 * of the centre) is read as the cell that makes.
 */
export function cleanLog(raw: unknown): RunEntry[] {
  if (!Array.isArray(raw)) return [];
  const log: RunEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { ok, time, cell, short, ret } = item as Record<string, unknown>;
    if (ret === true) {
      if (ok === true && isTime(time)) log.push({ ok: true, time, cell: null, ret: true });
      else if (ok === false) log.push({ ok: false, time: null, cell: null, ret: true });
      continue;
    }
    if (ok === true) {
      if (isTime(time)) log.push({ ok: true, time, cell: null });
    } else if (ok === false) {
      log.push({ ok: false, time: null, cell: isCell(cell) ? cell : isCells(short) ? cellFromShort(short) : null });
    }
  }
  return log;
}

/** The log that a sheet from before failed runs were recorded stands for. */
function legacyLog(times: number[], remaining: number | null): RunEntry[] {
  const log: RunEntry[] = times.filter(isTime).map((time) => ({ ok: true, time, cell: null }));
  if (!log.length && isCells(remaining)) log.push({ ok: false, time: null, cell: cellFromShort(remaining) });
  return log;
}

/** Whether the entry before `index` is a run that reached the centre: the only thing a return can follow. */
const followsSuccess = (log: RunEntry[], index: number): boolean => {
  const before = log[index - 1];
  return !!before && before.ok && !before.ret;
};

export function scoreSheet({ times, remaining, log: rawLog }: SheetInput): SheetResult {
  const stored = cleanLog(rawLog);
  const log = stored.length ? stored : legacyLog(times, remaining);
  const runsOnly = log.filter((run) => !run.ret);
  const clean = runsOnly.filter((run) => run.ok).map((run) => run.time!);
  const cells = runsOnly.filter((run) => !run.ok && run.cell !== null).map((run) => run.cell!);
  // A return out of place is refused when a sheet is saved; this keeps one
  // that got in some other way from scoring.
  const returnTimes = log.flatMap((run, index) => (run.ret && run.ok && followsSuccess(log, index) ? [run.time!] : []));
  const official = clean.length ? Math.min(...clean, ...returnTimes) : null;
  const score = official === null ? null : finalScore(clean.length, official, returnTimes.length);
  return {
    times: clean,
    log,
    runs: clean.length,
    failed: runsOnly.length - clean.length,
    returns: returnTimes.length,
    returnTimes,
    failedReturns: log.filter((run) => run.ret && !run.ok).length,
    official,
    score,
    // Only meaningful without a successful run; one that got there is not ranked by it.
    remaining: clean.length || !cells.length ? null : MAZE_CELLS - Math.max(...cells),
  };
}

/**
 * Which of the three kinds of sheet this is: every run reached the centre,
 * some did and some did not, or none did. "empty" before any run is written.
 */
export type SheetOutcome = "all-successful" | "mixed" | "none-successful" | "empty";

export function outcomeOf(sheet: Pick<SheetResult, "runs" | "failed">): SheetOutcome {
  if (sheet.runs === 0) return sheet.failed === 0 ? "empty" : "none-successful";
  return sheet.failed === 0 ? "all-successful" : "mixed";
}

/** The returns in a few words, to follow the runs: ", 2 returns". Empty with none. */
const returnsText = (returns = 0) => (returns ? `, ${returns} ${returns === 1 ? "return" : "returns"}` : "");

/** The outcome in a few words: "All 4 runs successful", "3 of 5 runs successful, 1 return". */
export function outcomeText(sheet: Pick<SheetResult, "runs" | "failed"> & { returns?: number }): string {
  const total = sheet.runs + sheet.failed;
  switch (outcomeOf(sheet)) {
    case "all-successful":
      return (total === 1 ? "1 run, successful" : `All ${total} runs successful`) + returnsText(sheet.returns);
    case "mixed":
      return `${sheet.runs} of ${total} runs successful${returnsText(sheet.returns)}`;
    case "none-successful":
      return total === 1 ? "1 run, not successful" : `None of ${total} runs successful`;
    default:
      return "No runs yet";
  }
}

/**
 * Negative when `a` ranks above `b`, positive when `b` does, zero when the
 * rulebook cannot tell them apart.
 *
 * Any score beats no score. Between scores the higher wins, and on an exact tie
 * the faster official time. Between mice that never reached the centre, the
 * one that got to the further cell wins, and one with no cell recorded comes
 * last.
 */
export function compareResults(
  a: Pick<SheetResult, "score" | "official" | "remaining">,
  b: Pick<SheetResult, "score" | "official" | "remaining">,
): number {
  if (a.score !== null || b.score !== null) {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    if (a.score !== b.score) return b.score - a.score;
    return (a.official ?? Infinity) - (b.official ?? Infinity);
  }
  if (a.remaining === null && b.remaining === null) return 0;
  if (a.remaining === null) return 1;
  if (b.remaining === null) return -1;
  return a.remaining - b.remaining;
}

/**
 * A run time from what a judge types: "25.4", "25,4", "25.412s" or "1:05.3".
 * Null for anything that is not a positive time inside the match.
 */
export function parseRunTime(value: unknown): number | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*(s|sec|secs|seconds)$/, "")
    .replace(",", ".");
  if (!raw) return null;
  let seconds: number;
  const clock = /^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(raw);
  if (clock) {
    const secs = Number(clock[2]);
    if (secs >= 60) return null;
    seconds = Number(clock[1]) * 60 + secs;
  } else if (/^\d+(\.\d+)?$/.test(raw)) {
    seconds = Number(raw);
  } else {
    return null;
  }
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MATCH_SECONDS) return null;
  return Math.round(seconds * 1000) / 1000;
}

/**
 * The cell a failed run reached: a whole number from 1 to 99, typed as "72" or
 * "cell 72". Cell 100 is the centre, which is a successful run, not a failed one.
 */
export function parseCell(value: unknown): number | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^cell\s*/, "");
  if (!/^\d{1,3}$/.test(raw)) return null;
  const cell = Number(raw);
  return cell >= 1 && cell < MAZE_CELLS ? cell : null;
}

export type SheetProblem = "bad-time" | "bad-cell" | "too-long" | "bad-return";

/** A run's result as typed: "yes", "Success" or "✓" is successful; "no", "Fail" or "✗" is not. */
export function parseRunResult(value: unknown): boolean | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["1", "yes", "y", "true", "ok", "success", "successful", "reached", "✓", "✔"].includes(raw)) return true;
  if (["0", "no", "n", "false", "fail", "failed", "unsuccessful", "not successful", "dnf", "x", "✗", "✘"].includes(raw)) return false;
  return null;
}

/** Whether a run's kind as typed says it is a return: "return", "ret", "R" or "↩". */
export function parseRunKind(value: unknown): boolean {
  return ["return", "returns", "ret", "r", "↩", "back"].includes(String(value ?? "").trim().toLowerCase());
}

/**
 * A result as written in a score file, which can also say it is a return:
 * "Success", "Fail", "Return" (made it back) or "Return fail". Null when it is
 * none of them.
 */
export function parseResultKind(value: unknown): { ok: boolean; ret: boolean } | null {
  const raw = String(value ?? "").trim().toLowerCase();
  const back = /^(return|ret|↩)\s*[:\-]?\s*/.exec(raw);
  if (!back) {
    const ok = parseRunResult(raw);
    return ok === null ? null : { ok, ret: false };
  }
  const rest = raw.slice(back[0].length);
  if (!rest) return { ok: true, ret: true };
  const ok = parseRunResult(rest);
  return ok === null ? null : { ok, ret: true };
}

/**
 * Runs about to be saved: every successful one has a time, every return comes
 * straight after a run that reached the centre, and together they fit in the
 * match.
 */
export function checkLog(log: RunEntry[]): SheetProblem | null {
  if (log.some((run) => run.ok && run.time === null)) return "bad-time";
  if (log.some((run, index) => run.ret && !followsSuccess(log, index))) return "bad-return";
  if (log.reduce((sum, run) => sum + (run.time ?? 0), 0) > MATCH_SECONDS) return "too-long";
  return null;
}

/**
 * A sheet from form fields: one time, one result and one cell field per run,
 * in order. A missing result counts as successful. A successful run is read by
 * its time and a failed one by its cell; the other field is ignored.
 *
 * A successful row with no time is a spare row and is skipped, so the form can
 * offer one. A failed row counts even when empty: the judge said a run
 * happened. Anything filled in that does not read refuses the whole sheet
 * rather than dropping a run quietly, and so do runs that add up to more than
 * the match.
 */
export function sheetFromFields(
  times: unknown[],
  results: unknown[] = [],
  cells: unknown[] = [],
  kinds: unknown[] = [],
): { ok: true; sheet: SheetResult } | { ok: false; problem: SheetProblem } {
  const log: RunEntry[] = [];
  for (let index = 0; index < times.length; index++) {
    const ok = parseRunResult(results[index]) ?? true;
    const ret = parseRunKind(kinds[index]);
    if (ok) {
      const timeText = String(times[index] ?? "").trim();
      const time = timeText ? parseRunTime(timeText) : null;
      if (timeText && time === null) return { ok: false, problem: "bad-time" };
      if (time !== null) log.push(ret ? { ok: true, time, cell: null, ret: true } : { ok: true, time, cell: null });
      continue;
    }
    // A return that did not make it back: nothing to write but that it happened.
    if (ret) {
      log.push({ ok: false, time: null, cell: null, ret: true });
      continue;
    }
    const cellText = String(cells[index] ?? "").trim();
    const cell = cellText ? parseCell(cellText) : null;
    if (cellText && cell === null) return { ok: false, problem: "bad-cell" };
    log.push({ ok: false, time: null, cell });
  }
  const problem = checkLog(log);
  if (problem) return { ok: false, problem };
  return { ok: true, sheet: scoreSheet({ times: [], remaining: null, log }) };
}

/** "25.41 s" under a minute, "1:05.30" from there. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "–";
  const trimmed = (value: number) => {
    const text = value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return text.includes(".") ? text : `${text}.0`;
  };
  if (seconds < 60) return `${trimmed(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${trimmed(rest)}`;
}

/** The score as the rulebook prints it, one decimal place. */
export function formatPoints(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return "–";
  return score.toFixed(1);
}

/**
 * The whole working, for a team page: "4 runs ÷ 25.0 s × 1000 = 160.0", owning
 * up to the failed runs when there were some.
 */
export function workingOf(sheet: Pick<SheetResult, "runs" | "official" | "score" | "remaining"> & { failed?: number; returns?: number }): string {
  const failed = sheet.failed ?? 0;
  const returns = sheet.returns ?? 0;
  if (sheet.score === null || sheet.official === null) {
    const tries = failed > 1 ? ` in ${failed} runs` : "";
    return sheet.remaining === null
      ? `No run reached the centre${tries}.`
      : `No run reached the centre${tries}. The furthest reached ${formatReached(sheet.remaining)} of ${MAZE_CELLS}.`;
  }
  const runs = `${sheet.runs} ${failed ? "successful " : ""}${sheet.runs === 1 ? "run" : "runs"}`;
  const counted = returns ? `(${runs} + ${RULES.returnWeight} × ${returns} ${returns === 1 ? "return" : "returns"})` : runs;
  const sum = `${counted} ÷ ${formatTime(sheet.official)} × 1000 = ${formatPoints(sheet.score)}`;
  return failed ? `${sum}. ${failed === 1 ? "The failed run does" : `The ${failed} failed runs do`} not count.` : sum;
}

/** "cell 72": the furthest cell, from how many cells short of the centre a mouse stopped. */
export function formatReached(remaining: number): string {
  const cell = cellFromShort(remaining);
  return `cell ${Number.isInteger(cell) ? cell : Math.round(cell * 10) / 10}`;
}
