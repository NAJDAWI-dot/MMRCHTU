import { RULES, finalScore } from "@/lib/rules";

/**
 * A match sheet: what a judge writes down about one team's eight minutes.
 *
 * The rulebook scores both phases the same way:
 *
 *     final score = (successful runs / official time) * 1000
 *
 * where the official time is the team's fastest successful run. The desk
 * writes down every run, successful or not: a time for each one that reached
 * the centre, and for one that did not, how far short it stopped (and its time,
 * if anyone took it). The score, the run count and the official time all come
 * out of this file. Failed runs add nothing to the score, so a team with some
 * of each is scored on its successful ones alone. A mouse that never reached
 * the centre has no score at all; the rulebook ranks those by how far short of
 * the centre they stopped, lowest first, and below every mouse that did.
 *
 * Pure: the scoring desk, the public pages and the tests all use it.
 */

/** The whole match, in seconds. No run, and no set of runs, can be longer. */
export const MATCH_SECONDS = RULES.matchMinutes * 60;

/**
 * One run, as the judge wrote it down. A successful run always has a time. A
 * failed one has how many cells short of the centre it stopped, and its time,
 * when either was taken.
 */
export interface RunEntry {
  ok: boolean;
  time: number | null;
  short: number | null;
}

export interface SheetInput {
  /** Seconds, one per run that reached the centre, in the order they were run. */
  times: number[];
  /** Cells short of the centre, for a mouse with no successful run. */
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
  /** The fewest cells short of the centre, for a mouse with no successful run. */
  remaining: number | null;
  /** Every run, in order. */
  log: RunEntry[];
  /** Successful runs: how many times there are. */
  runs: number;
  /** Runs that did not reach the centre. */
  failed: number;
  /** The fastest run, or null with none. */
  official: number | null;
  /** The formula's result, or null with no successful run. */
  score: number | null;
}

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const isCells = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * A log as stored (JSON, so anything) made safe: entries that are not runs are
 * dropped, and a "successful" run with no time is not one.
 */
export function cleanLog(raw: unknown): RunEntry[] {
  if (!Array.isArray(raw)) return [];
  const log: RunEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { ok, time, short } = item as Record<string, unknown>;
    if (ok === true) {
      if (isTime(time)) log.push({ ok: true, time, short: null });
    } else if (ok === false) {
      log.push({ ok: false, time: isTime(time) ? time : null, short: isCells(short) ? short : null });
    }
  }
  return log;
}

/** The log that a sheet from before failed runs were recorded stands for. */
function legacyLog(times: number[], remaining: number | null): RunEntry[] {
  const log: RunEntry[] = times.filter(isTime).map((time) => ({ ok: true, time, short: null }));
  if (!log.length && isCells(remaining)) log.push({ ok: false, time: null, short: remaining });
  return log;
}

export function scoreSheet({ times, remaining, log: rawLog }: SheetInput): SheetResult {
  const stored = cleanLog(rawLog);
  const log = stored.length ? stored : legacyLog(times, remaining);
  const clean = log.filter((run) => run.ok).map((run) => run.time!);
  const shorts = log.filter((run) => !run.ok && run.short !== null).map((run) => run.short!);
  const official = clean.length ? Math.min(...clean) : null;
  const score = official === null ? null : finalScore(clean.length, official);
  return {
    times: clean,
    log,
    runs: clean.length,
    failed: log.length - clean.length,
    official,
    score,
    // Only meaningful without a successful run; one that got there is not ranked by it.
    remaining: clean.length || !shorts.length ? null : Math.min(...shorts),
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

/** The outcome in a few words: "All 4 runs successful", "3 of 5 runs successful". */
export function outcomeText(sheet: Pick<SheetResult, "runs" | "failed">): string {
  const total = sheet.runs + sheet.failed;
  switch (outcomeOf(sheet)) {
    case "all-successful":
      return total === 1 ? "1 run, successful" : `All ${total} runs successful`;
    case "mixed":
      return `${sheet.runs} of ${total} runs successful`;
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
 * one that stopped closer wins, and one with no distance recorded comes last.
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

/** A distance short of the centre, in cells: zero or more, halves allowed. */
export function parseRemaining(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const cells = Number(raw);
  return Number.isFinite(cells) && cells >= 0 && cells < 1000 ? cells : null;
}

export type SheetProblem = "bad-time" | "bad-short" | "too-long";

/** A run's result as typed: "yes", "Success" or "✓" is successful; "no", "Fail" or "✗" is not. */
export function parseRunResult(value: unknown): boolean | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["1", "yes", "y", "true", "ok", "success", "successful", "reached", "✓", "✔"].includes(raw)) return true;
  if (["0", "no", "n", "false", "fail", "failed", "unsuccessful", "not successful", "dnf", "x", "✗", "✘"].includes(raw)) return false;
  return null;
}

/** Runs about to be saved: every successful one has a time, and together they fit in the match. */
export function checkLog(log: RunEntry[]): SheetProblem | null {
  if (log.some((run) => run.ok && run.time === null)) return "bad-time";
  if (log.reduce((sum, run) => sum + (run.time ?? 0), 0) > MATCH_SECONDS) return "too-long";
  return null;
}

/**
 * A sheet from form fields: one time, one result and one cells-short field per
 * run, in order. A missing result counts as successful.
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
  shorts: unknown[] = [],
): { ok: true; sheet: SheetResult } | { ok: false; problem: SheetProblem } {
  const log: RunEntry[] = [];
  for (let index = 0; index < times.length; index++) {
    const ok = parseRunResult(results[index]) ?? true;
    const timeText = String(times[index] ?? "").trim();
    const shortText = String(shorts[index] ?? "").trim();
    const time = timeText ? parseRunTime(timeText) : null;
    if (timeText && time === null) return { ok: false, problem: "bad-time" };
    if (ok) {
      if (time !== null) log.push({ ok: true, time, short: null });
      continue;
    }
    const short = shortText ? parseRemaining(shortText) : null;
    if (shortText && short === null) return { ok: false, problem: "bad-short" };
    log.push({ ok: false, time, short });
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
export function workingOf(sheet: Pick<SheetResult, "runs" | "official" | "score" | "remaining"> & { failed?: number }): string {
  const failed = sheet.failed ?? 0;
  if (sheet.score === null || sheet.official === null) {
    const tries = failed > 1 ? ` in ${failed} runs` : "";
    return sheet.remaining === null
      ? `No run reached the centre${tries}.`
      : `No run reached the centre${tries}. The closest stopped ${formatCells(sheet.remaining)} short.`;
  }
  const sum = `${sheet.runs} ${failed ? "successful " : ""}${sheet.runs === 1 ? "run" : "runs"} ÷ ${formatTime(sheet.official)} × 1000 = ${formatPoints(sheet.score)}`;
  return failed ? `${sum}. ${failed === 1 ? "The failed run does" : `The ${failed} failed runs do`} not count.` : sum;
}

export function formatCells(cells: number): string {
  const text = Number.isInteger(cells) ? String(cells) : String(Math.round(cells * 10) / 10);
  return `${text} ${cells === 1 ? "cell" : "cells"}`;
}
