import { FINAL_ROUND, FIRST_KNOCKOUT_ROUND, journeyOf, phaseInfo, type ResolvedMatch, type Standing } from "@/lib/bracket";
import type { BracketMatch, CompetitionState } from "@/lib/competition";

/**
 * What the public is allowed to see of the results, phase by phase.
 *
 * The desks record everything as it happens; the organisers decide when the
 * room finds out. For each phase (1 is qualifying, 2 to 6 the knockout rounds)
 * two things can be held back on their own:
 *
 *  - its results: scores, run times, the runs themselves and the places;
 *  - who went through from it.
 *
 * Holding back who went through from a phase also holds back the next round's
 * pairings, and every round after that, since the pairings would give it away.
 *
 * Pure: the day site and the hall screen read the competition through
 * redactCompetition, and the tests check it directly.
 */

export const REVEAL_PHASES = [1, 2, 3, 4, 5, 6] as const;

export interface Reveal {
  hiddenResults: number[];
  hiddenAdvance: number[];
}

export const NOTHING_HIDDEN: Reveal = { hiddenResults: [], hiddenAdvance: [] };

/** "1,3" to [1, 3]; anything that is not a phase is dropped. */
export function parsePhaseList(value: unknown): number[] {
  const phases = String(value ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((phase) => (REVEAL_PHASES as readonly number[]).includes(phase));
  return [...new Set(phases)].sort((a, b) => a - b);
}

export function serializePhaseList(phases: readonly number[]): string {
  return parsePhaseList(phases.join(",")).join(",");
}

export function revealOf(config: { hiddenResults: string; hiddenAdvance: string }): Reveal {
  return { hiddenResults: parsePhaseList(config.hiddenResults), hiddenAdvance: parsePhaseList(config.hiddenAdvance) };
}

export const resultsShown = (reveal: Reveal, phase: number) => !reveal.hiddenResults.includes(phase);
export const advanceShown = (reveal: Reveal, phase: number) => !reveal.hiddenAdvance.includes(phase);
export const anythingHidden = (reveal: Reveal) => reveal.hiddenResults.length > 0 || reveal.hiddenAdvance.length > 0;

/**
 * The first knockout round whose pairings are held back: the round after the
 * first phase whose "who went through" is hidden. Past the final: none.
 */
export function firstHiddenRound(reveal: Reveal): number {
  for (let round = FIRST_KNOCKOUT_ROUND; round <= FINAL_ROUND; round++) {
    if (!advanceShown(reveal, round - 1)) return round;
  }
  return FINAL_ROUND + 1;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** The qualifying table as the public may see it. */
export function redactTable(table: Standing[], reveal: Reveal): Standing[] {
  const showResults = resultsShown(reveal, 1);
  const showAdvance = advanceShown(reveal, 1);
  if (showResults && showAdvance) return table;
  const rows = table.map((row) => ({
    ...row,
    ...(showResults
      ? {}
      : { best: null, official: null, times: [], log: [], remaining: null, runs: 0, failed: 0, rank: null, bestAt: null }),
    ...(showAdvance ? {} : { qualified: false, override: "" as const }),
  }));
  // Without results the order would give the places away: alphabetical, and
  // with who went through shown, those first.
  return showResults ? rows : rows.sort((a, b) => Number(b.qualified) - Number(a.qualified) || byName(a, b));
}

/** The bracket as the public may see it. */
export function redactBracket<T extends ResolvedMatch>(matches: T[], reveal: Reveal): T[] {
  const hiddenFrom = firstHiddenRound(reveal);
  return matches.map((match) => {
    if (match.round >= hiddenFrom) {
      // Who is even in it would say who won before.
      return {
        ...match,
        teamAId: null,
        teamBId: null,
        seedA: null,
        seedB: null,
        scoreA: null,
        scoreB: null,
        timesA: [],
        timesB: [],
        remainingA: null,
        remainingB: null,
        runLogA: [],
        runLogB: [],
        winnerId: null,
        winnerOverride: false,
        walkover: false,
        tied: false,
        ...("status" in match ? { status: "PENDING" } : {}),
      };
    }
    let out = match;
    if (!resultsShown(reveal, match.round)) {
      out = { ...out, scoreA: null, scoreB: null, timesA: [], timesB: [], remainingA: null, remainingB: null, runLogA: [], runLogB: [], tied: false };
    }
    if (!advanceShown(reveal, match.round) && !match.walkover) {
      const status = "status" in out ? (out as unknown as BracketMatch).status : undefined;
      out = { ...out, winnerId: null, winnerOverride: false, tied: false, ...(status === "DONE" ? { status: "PENDING" } : {}) };
    }
    return out;
  });
}

/**
 * The whole competition as the public may see it: the table, the bracket and
 * every team's standing and journey, worked out again from what is left so no
 * badge says more than the pages do.
 */
export function redactCompetition(state: CompetitionState, reveal: Reveal): CompetitionState {
  if (!anythingHidden(reveal)) return { ...state, reveal };
  const table = redactTable(state.table, reveal);
  const bracket = redactBracket(state.bracket, reveal);
  const standingOf = new Map(table.map((row) => [row.teamId, row]));
  const qualifyingOut = state.drawn && advanceShown(reveal, 1);
  const competitors = state.competitors.map((team) => {
    const standing = standingOf.get(team.id);
    const journey = journeyOf(team.id, standing, bracket, qualifyingOut);
    if (state.drawn && !qualifyingOut && journey.state === "QUALIFYING") journey.label = "Results to come";
    return { ...team, standing, journey };
  });
  return {
    ...state,
    table,
    bracket,
    competitors,
    byId: new Map(competitors.map((team) => [team.id, team])),
    // Publicly the draw has not happened until who qualified is announced.
    drawn: qualifyingOut,
    reveal,
  };
}

/** The last reveal, when it was within `windowMs` of now: what the hall screen plays. */
export interface LastReveal {
  phase: number | "all";
  kind: "results" | "advance" | "all";
  at: number;
}

export function recentReveal(value: string, now: number, windowMs = 10 * 60_000): LastReveal | null {
  const [phaseText, kindText, atText] = String(value ?? "").split("|");
  const at = Number(atText);
  if (!Number.isFinite(at) || now - at > windowMs || at - now > 60_000) return null;
  const phase = phaseText === "all" ? "all" : Number(phaseText);
  if (phase !== "all" && !(REVEAL_PHASES as readonly number[]).includes(phase)) return null;
  const kind = kindText === "advance" || kindText === "results" || kindText === "all" ? kindText : null;
  if (!kind) return null;
  return { phase, kind, at };
}

const listOf = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * What a page should say about the phases it shows that are held back: at most
 * two short lines, or none when everything on it is public.
 */
export function heldBackLines(reveal: Reveal | undefined, phases: readonly number[]): string[] {
  if (!reveal) return [];
  const results = phases.filter((phase) => !resultsShown(reveal, phase)).map((phase) => phaseInfo(phase).name);
  const advance = phases.filter((phase) => !advanceShown(reveal, phase)).map((phase) => phaseInfo(phase).name);
  const lines: string[] = [];
  if (results.length) lines.push(`${results.length === phases.length && phases.length > 1 ? "All scores are" : `${listOf(results)} scores are`} under wraps until they are announced.`);
  if (advance.length) lines.push(`Who goes through from the ${listOf(advance)} is announced soon.`);
  return lines;
}
