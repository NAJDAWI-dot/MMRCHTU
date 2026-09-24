import type { Prisma } from "@prisma/client";
import { changedMatches, resolveBracket, type MatchInput, type ResolvedMatch } from "@/lib/bracket";
import { dayKey, runningDayKey } from "@/lib/day-mode";
import { zonedInstant } from "@/lib/day-slots";
import { compareResults, type RunEntry, type SheetResult } from "@/lib/score-sheet";

/**
 * Putting a knockout result into the bracket, shared by the Bracket desk's form
 * and the scores import so both decide winners and move them on the same way.
 */

/** A knockout row as stored: the bracket's input plus what only the row knows. */
export type StoredMatch = MatchInput & { id: string; status: string };

/** A run log as Prisma writes JSON. */
export function logJson(log: RunEntry[]): Prisma.InputJsonValue {
  return log.map((run) => ({ ok: run.ok, time: run.time, cell: run.cell }));
}

/** The competition day as a "2026-03-14" key: the set date, or today's. */
export function competitionDayKey(eventDate: Date | null, now: Date = new Date()): string {
  return eventDate ? dayKey(eventDate) : runningDayKey(now);
}

/**
 * When a team runs in qualifying: its own slot time when one was set or
 * imported, otherwise the start plus a slot length for each place before it.
 */
export function qualifyingSlot(
  team: { runOrder: number | null; slotTime: string },
  config: { runOrderStart: string; runSlotMinutes: number },
  day: string,
): Date | null {
  if (team.slotTime) return zonedInstant(day, team.slotTime);
  if (!team.runOrder || !config.runOrderStart) return null;
  const start = zonedInstant(day, config.runOrderStart);
  return new Date(start.getTime() + (team.runOrder - 1) * (config.runSlotMinutes || 10) * 60_000);
}

export type MatchPlan =
  | { ok: false; message: string }
  | {
      ok: true;
      /** The whole bracket, resolved with this result in it. */
      matches: ResolvedMatch[];
      /** The matches that differ from the rows and need writing. */
      changed: ResolvedMatch[];
      /** Later matches whose results this throws away, because their teams change. */
      later: ResolvedMatch[];
      target: ResolvedMatch;
    };

/**
 * One match's result from both sides' sheets, and what it does to the rest of
 * the bracket.
 *
 * The winner is worked out the rulebook's way: the higher score, the faster
 * official time on an exact tie, then whoever got closer to the centre when
 * neither side reached it. A tie that survives all of that, or a match decided
 * without being run (a no-show), takes the scorer's pick.
 *
 * With `override`, the pick is the judges' decision and stands whatever the
 * sheets say (a disqualification, a ruling on a protest).
 */
export function planMatchResult(
  rows: StoredMatch[],
  target: StoredMatch,
  a: SheetResult,
  b: SheetResult,
  picked: string | null,
  override = false,
): MatchPlan {
  const played = a.log.length > 0 || b.log.length > 0;
  const winnerOverride = override && !!picked;

  let winnerId: string | null = picked;
  if (played && target.teamAId && target.teamBId && !winnerOverride) {
    const cmp = compareResults(a, b);
    if (cmp !== 0) winnerId = cmp < 0 ? target.teamAId : target.teamBId;
    else if (!picked) return { ok: false, message: "The two sheets are level on everything the rulebook compares. Pick the winner." };
  }

  const edited: MatchInput[] = rows.map((row) =>
    row.id === target.id
      ? {
          ...row,
          scoreA: played ? a.score : null,
          scoreB: played ? b.score : null,
          timesA: a.times,
          timesB: b.times,
          remainingA: a.remaining,
          remainingB: b.remaining,
          runLogA: a.log,
          runLogB: b.log,
          winnerId,
          winnerOverride,
        }
      : row,
  );
  const { matches, conflicts } = resolveBracket(edited, "HIGHER");
  const isTarget = (match: { round: number; slot: number }) => match.round === target.round && match.slot === target.slot;
  return {
    ok: true,
    matches,
    changed: changedMatches(rows, matches),
    later: conflicts.filter((match) => !isTarget(match)),
    target: matches.find(isTarget)!,
  };
}
