import { RULES, finalScore } from "@/lib/rules";

/**
 * A match sheet: what a judge writes down about one team's eight minutes.
 *
 * The rulebook scores both phases the same way:
 *
 *     final score = (successful runs / official time) * 1000
 *
 * where the official time is the team's fastest successful run. So the desk
 * only ever types in the time of each run that reached the centre, and the
 * score, the run count and the official time all come out of this file. A
 * mouse that never reached the centre has no score at all; the rulebook ranks
 * those by how far short of the centre they stopped, lowest first, and below
 * every mouse that did reach it.
 *
 * Pure: the scoring desk, the public pages and the tests all use it.
 */

/** The whole match, in seconds. No run, and no set of runs, can be longer. */
export const MATCH_SECONDS = RULES.matchMinutes * 60;

export interface SheetInput {
  /** Seconds, one per run that reached the centre, in the order they were run. */
  times: number[];
  /** Cells short of the centre, for a mouse with no successful run. */
  remaining: number | null;
}

export interface SheetResult extends SheetInput {
  /** Successful runs: how many times there are. */
  runs: number;
  /** The fastest run, or null with none. */
  official: number | null;
  /** The formula's result, or null with no successful run. */
  score: number | null;
}

export function scoreSheet({ times, remaining }: SheetInput): SheetResult {
  const clean = times.filter((time) => Number.isFinite(time) && time > 0);
  const official = clean.length ? Math.min(...clean) : null;
  const score = official === null ? null : finalScore(clean.length, official);
  return {
    times: clean,
    runs: clean.length,
    official,
    score,
    // Only meaningful without a successful run; one that got there is not ranked by it.
    remaining: clean.length ? null : remaining,
  };
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

export type SheetProblem = "bad-time" | "too-long";

/**
 * A sheet from form fields: every `time` field, and `remaining`.
 *
 * Blank rows are skipped, so the form can offer spare ones. A row that is
 * filled in but is not a time refuses the whole sheet rather than dropping a
 * run quietly, and so do runs that add up to more than the match.
 */
export function sheetFromFields(
  times: unknown[],
  remaining: unknown,
): { ok: true; sheet: SheetResult } | { ok: false; problem: SheetProblem } {
  const parsed: number[] = [];
  for (const value of times) {
    if (!String(value ?? "").trim()) continue;
    const time = parseRunTime(value);
    if (time === null) return { ok: false, problem: "bad-time" };
    parsed.push(time);
  }
  if (parsed.reduce((sum, time) => sum + time, 0) > MATCH_SECONDS) return { ok: false, problem: "too-long" };
  return { ok: true, sheet: scoreSheet({ times: parsed, remaining: parseRemaining(remaining) }) };
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

/** The whole working, for a team page: "4 runs ÷ 25.0 s × 1000 = 160.0". */
export function workingOf(sheet: Pick<SheetResult, "runs" | "official" | "score" | "remaining">): string {
  if (sheet.score === null || sheet.official === null) {
    return sheet.remaining === null
      ? "No run reached the centre."
      : `No run reached the centre. Stopped ${formatCells(sheet.remaining)} short.`;
  }
  return `${sheet.runs} ${sheet.runs === 1 ? "run" : "runs"} ÷ ${formatTime(sheet.official)} × 1000 = ${formatPoints(sheet.score)}`;
}

export function formatCells(cells: number): string {
  const text = Number.isInteger(cells) ? String(cells) : String(Math.round(cells * 10) / 10);
  return `${text} ${cells === 1 ? "cell" : "cells"}`;
}
