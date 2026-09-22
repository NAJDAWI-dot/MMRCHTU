/**
 * The competition's scoring: qualifying standings and the knockout bracket.
 *
 * Pure functions over plain values, with no Prisma and no clock, so every rule
 * here is tested in tests/unit/bracket.test.ts rather than discovered on the
 * day. The admin actions read rows, hand them to these, and write back what
 * comes out.
 *
 * Phase 1 is qualifying. Its format is not decided yet, so it is kept general:
 * a team may run any number of times and its best run counts, "best" meaning
 * highest or lowest by a setting.
 *
 * Phases 2 to 6 are the knockout: the top 32 of qualifying, seeded 1 v 32,
 * 2 v 31 and so on, then the round of 16, quarter-finals, semi-finals and the
 * final. The first round is laid out in the standard bracket order, so the
 * winners of neighbouring matches meet, and seeds 1 and 2 can only meet in the
 * final.
 */

export type Direction = "HIGHER" | "LOWER";

export function parseDirection(value: unknown): Direction {
  return String(value ?? "").toUpperCase() === "LOWER" ? "LOWER" : "HIGHER";
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  HIGHER: "Higher score is better",
  LOWER: "Lower score is better (a time, say)",
};

/** How many teams go through from qualifying. */
export const QUALIFIERS = 32;

export const FIRST_KNOCKOUT_ROUND = 2;
export const FINAL_ROUND = 6;
export const KNOCKOUT_ROUNDS = [2, 3, 4, 5, 6] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

export interface PhaseInfo {
  phase: number;
  name: string;
  short: string;
  /** Teams at the start of the phase. */
  teams: number | null;
  blurb: string;
}

export const PHASES: readonly PhaseInfo[] = [
  {
    phase: 1,
    name: "Qualifying",
    short: "Q",
    teams: null,
    blurb: "Every team runs. The best run counts, and the top 32 go through.",
  },
  { phase: 2, name: "Round of 32", short: "R32", teams: 32, blurb: "Head to head: 1st plays 32nd, 2nd plays 31st, and so on." },
  { phase: 3, name: "Round of 16", short: "R16", teams: 16, blurb: "The sixteen winners, down the bracket." },
  { phase: 4, name: "Quarter-finals", short: "QF", teams: 8, blurb: "Eight left." },
  { phase: 5, name: "Semi-finals", short: "SF", teams: 4, blurb: "Four left." },
  { phase: 6, name: "Final", short: "F", teams: 2, blurb: "One match for the title." },
];

export function phaseInfo(phase: number): PhaseInfo {
  return PHASES.find((info) => info.phase === phase) ?? PHASES[0]!;
}

/** Matches in a knockout round: 16, 8, 4, 2, 1. */
export function matchesInRound(round: number): number {
  return 2 ** (FINAL_ROUND - round);
}

// ------------------------------------------------------------------ compare

/** Negative when `a` is the better score, positive when `b` is, zero on a tie. */
export function compareScores(a: number, b: number, direction: Direction): number {
  if (a === b) return 0;
  const aBetter = direction === "HIGHER" ? a > b : a < b;
  return aBetter ? -1 : 1;
}

/** "12.5", "12", "0.75": what a score looks like on a page. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

/** A score from a form field, or null when there is not one. */
export function parseScore(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

// ---------------------------------------------------------------- phase one

export interface RunLike {
  registrationId: string;
  score: number;
  createdAt: Date;
}

export interface TeamLike {
  id: string;
  name: string;
}

export interface Standing {
  teamId: string;
  name: string;
  best: number | null;
  /** When the best run was recorded: the tie-break, first to set it wins. */
  bestAt: Date | null;
  runs: number;
  /** 1-based, or null for a team with no runs or not eligible. */
  rank: number | null;
  qualified: boolean;
  eligible: boolean;
}

/**
 * The qualifying table.
 *
 * Ranked by best run, then by who set that score first, then by name so the
 * order never depends on the database. Teams with no run yet, and teams not
 * eligible (withdrawn, or failed inspection), are listed after the ranked ones
 * without a rank, so the table shows everyone but only ranks who can go
 * through.
 */
export function standings(
  teams: TeamLike[],
  runs: RunLike[],
  direction: Direction,
  options: { cutoff?: number; ineligible?: ReadonlySet<string> } = {},
): Standing[] {
  const cutoff = options.cutoff ?? QUALIFIERS;
  const ineligible = options.ineligible ?? new Set<string>();

  const best = new Map<string, { score: number; at: Date; count: number }>();
  for (const run of runs) {
    const current = best.get(run.registrationId);
    if (!current) {
      best.set(run.registrationId, { score: run.score, at: run.createdAt, count: 1 });
      continue;
    }
    current.count += 1;
    const cmp = compareScores(run.score, current.score, direction);
    if (cmp < 0 || (cmp === 0 && run.createdAt < current.at)) {
      current.score = run.score;
      current.at = run.createdAt;
    }
  }

  const rows = teams.map((team) => {
    const entry = best.get(team.id);
    return {
      teamId: team.id,
      name: team.name,
      best: entry?.score ?? null,
      bestAt: entry?.at ?? null,
      runs: entry?.count ?? 0,
      eligible: !ineligible.has(team.id),
    };
  });

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" });

  const ranked = rows
    .filter((row) => row.best !== null && row.eligible)
    .sort(
      (a, b) =>
        compareScores(a.best!, b.best!, direction) ||
        a.bestAt!.getTime() - b.bestAt!.getTime() ||
        byName(a, b),
    );
  const unranked = rows.filter((row) => row.best === null || !row.eligible).sort(byName);

  return [
    ...ranked.map((row, index) => ({ ...row, rank: index + 1, qualified: index < cutoff })),
    ...unranked.map((row) => ({ ...row, rank: null, qualified: false })),
  ];
}

// ------------------------------------------------------------------ seeding

/**
 * Seeds in bracket order: 1, 32, 16, 17, 8, 25, ... for 32.
 *
 * Built by doubling: each seed s in a bracket of n becomes the pair (s, 2n+1-s)
 * in a bracket of 2n. Read in pairs it gives the first round, and it is what
 * keeps the top seeds apart until the end.
 */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((seed) => [seed, next + 1 - seed]);
  }
  return order;
}

export interface SeededMatch {
  round: number;
  slot: number;
  seedA: number;
  seedB: number;
  teamAId: string | null;
  teamBId: string | null;
}

/**
 * The round of 32, from team ids in seed order (index 0 is seed 1).
 *
 * With fewer than 32 qualifiers the missing seeds are byes, and because the
 * missing ones are always the lowest, the byes fall to the top seeds.
 */
export function seedFirstRound(bySeed: string[], size: number = QUALIFIERS): SeededMatch[] {
  const order = bracketOrder(size);
  const matches: SeededMatch[] = [];
  for (let slot = 0; slot < size / 2; slot++) {
    const seedA = order[slot * 2]!;
    const seedB = order[slot * 2 + 1]!;
    matches.push({
      round: FIRST_KNOCKOUT_ROUND,
      slot,
      seedA,
      seedB,
      teamAId: bySeed[seedA - 1] ?? null,
      teamBId: bySeed[seedB - 1] ?? null,
    });
  }
  return matches;
}

/** Where the winner of a match goes: slot k of the next round, side by parity. */
export function nextSlot(round: number, slot: number): { round: number; slot: number; side: "A" | "B" } | null {
  if (round >= FINAL_ROUND) return null;
  return { round: round + 1, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? "A" : "B" };
}

// ------------------------------------------------------------ the bracket

export interface MatchInput {
  id: string;
  round: number;
  slot: number;
  teamAId: string | null;
  teamBId: string | null;
  seedA: number | null;
  seedB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
}

export interface ResolvedMatch extends MatchInput {
  /** Neither side can ever have a team: two byes met. Nobody plays it. */
  void: boolean;
  /** Decided without being played, because one side is a bye. */
  walkover: boolean;
  /** Both teams known and both scores in, and they are level: pick a winner. */
  tied: boolean;
}

export interface BracketResolution {
  matches: ResolvedMatch[];
  /**
   * Matches whose teams would change although a result is already stored for
   * them. Resolving clears those results, so an edit that produces any of these
   * is refused unless the admin has said to clear them.
   */
  conflicts: ResolvedMatch[];
}

type Side = { team: string | null; seed: number | null; bye: boolean };

/**
 * Works the whole bracket out from the first round and the results entered.
 *
 * Later rounds are never trusted as stored: their teams are recomputed from
 * the winners feeding them, which is what makes editing an early result safe.
 * A match whose teams change loses its scores, since they were for a different
 * pairing, and is reported as a conflict if it had any.
 *
 * Who wins: the better score when both are in and differ. Otherwise the stored
 * winner, if it is one of the two teams: a tie broken by the scorer, or a
 * walkover entered with no scores. A team facing a bye goes through on its own.
 */
export function resolveBracket(input: MatchInput[], direction: Direction): BracketResolution {
  const byKey = new Map(input.map((match) => [`${match.round}:${match.slot}`, match]));
  const resolved = new Map<string, ResolvedMatch>();
  const conflicts: ResolvedMatch[] = [];

  const outcome = new Map<string, Side>();

  for (const round of KNOCKOUT_ROUNDS) {
    for (let slot = 0; slot < matchesInRound(round); slot++) {
      const key = `${round}:${slot}`;
      const stored = byKey.get(key);

      let sideA: Side;
      let sideB: Side;
      if (round === FIRST_KNOCKOUT_ROUND) {
        sideA = { team: stored?.teamAId ?? null, seed: stored?.seedA ?? null, bye: !stored?.teamAId };
        sideB = { team: stored?.teamBId ?? null, seed: stored?.seedB ?? null, bye: !stored?.teamBId };
      } else {
        sideA = outcome.get(`${round - 1}:${slot * 2}`) ?? { team: null, seed: null, bye: false };
        sideB = outcome.get(`${round - 1}:${slot * 2 + 1}`) ?? { team: null, seed: null, bye: false };
      }

      const teamsChanged =
        !!stored && (stored.teamAId !== sideA.team || stored.teamBId !== sideB.team);
      // A result somebody entered: scores, or a winner picked between two real
      // teams. A winner that only came from a bye is not one; it is redrawn
      // as freely as the pairing is.
      const hadResult =
        !!stored &&
        (stored.scoreA !== null ||
          stored.scoreB !== null ||
          (stored.winnerId !== null && stored.teamAId !== null && stored.teamBId !== null));

      let scoreA = teamsChanged ? null : (stored?.scoreA ?? null);
      let scoreB = teamsChanged ? null : (stored?.scoreB ?? null);
      const storedWinner = teamsChanged ? null : (stored?.winnerId ?? null);

      let winnerId: string | null = null;
      let walkover = false;
      let tied = false;
      const isVoid = sideA.bye && sideB.bye;

      if (sideA.team && sideB.team) {
        if (scoreA !== null && scoreB !== null && compareScores(scoreA, scoreB, direction) !== 0) {
          winnerId = compareScores(scoreA, scoreB, direction) < 0 ? sideA.team : sideB.team;
        } else {
          tied = scoreA !== null && scoreB !== null;
          if (storedWinner === sideA.team || storedWinner === sideB.team) winnerId = storedWinner;
        }
      } else if (sideA.team && sideB.bye) {
        winnerId = sideA.team;
        walkover = true;
        scoreA = null;
        scoreB = null;
      } else if (sideB.team && sideA.bye) {
        winnerId = sideB.team;
        walkover = true;
        scoreA = null;
        scoreB = null;
      }

      const match: ResolvedMatch = {
        id: stored?.id ?? "",
        round,
        slot,
        teamAId: sideA.team,
        teamBId: sideB.team,
        seedA: sideA.seed,
        seedB: sideB.seed,
        scoreA,
        scoreB,
        winnerId,
        void: isVoid,
        walkover,
        tied,
      };
      resolved.set(key, match);
      if (teamsChanged && hadResult) {
        conflicts.push(match);
      }

      const winnerSeed = winnerId === sideA.team ? sideA.seed : winnerId === sideB.team ? sideB.seed : null;
      outcome.set(key, { team: winnerId, seed: winnerSeed, bye: isVoid });
    }
  }

  return {
    matches: [...resolved.values()],
    conflicts,
  };
}

/** Which stored matches differ from the resolution, and therefore need writing. */
export function changedMatches(input: MatchInput[], resolved: ResolvedMatch[]): ResolvedMatch[] {
  const byKey = new Map(input.map((match) => [`${match.round}:${match.slot}`, match]));
  return resolved.filter((match) => {
    const stored = byKey.get(`${match.round}:${match.slot}`);
    if (!stored) return true;
    return (
      stored.teamAId !== match.teamAId ||
      stored.teamBId !== match.teamBId ||
      stored.seedA !== match.seedA ||
      stored.seedB !== match.seedB ||
      stored.scoreA !== match.scoreA ||
      stored.scoreB !== match.scoreB ||
      stored.winnerId !== match.winnerId
    );
  });
}

// -------------------------------------------------------- a team's journey

export type JourneyState =
  | "REGISTERED"
  | "QUALIFYING"
  | "NOT_QUALIFIED"
  | "QUALIFIED"
  | "ALIVE"
  | "ELIMINATED"
  | "RUNNER_UP"
  | "CHAMPION";

export interface Journey {
  state: JourneyState;
  /** Short words for a badge. */
  label: string;
  /** The round the team is in now, or went out in. */
  round: number | null;
  seed: number | null;
}

/**
 * Where a team stands, in one phrase, from everything above.
 *
 * `qualifyingLocked` is whether the top 32 have been drawn into the bracket;
 * before that, the table is provisional and nobody has qualified yet.
 */
export function journeyOf(
  teamId: string,
  standing: Standing | undefined,
  matches: ResolvedMatch[],
  qualifyingLocked: boolean,
): Journey {
  const mine = matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .sort((a, b) => a.round - b.round);
  const first = mine.find((match) => match.round === FIRST_KNOCKOUT_ROUND);
  const seed = first ? (first.teamAId === teamId ? first.seedA : first.seedB) : null;

  if (mine.length > 0) {
    const last = mine[mine.length - 1]!;
    const name = phaseInfo(last.round).name;
    if (last.winnerId === null) {
      return { state: "ALIVE", label: `In the ${name}`, round: last.round, seed };
    }
    if (last.winnerId === teamId) {
      if (last.round === FINAL_ROUND) return { state: "CHAMPION", label: "Champions", round: last.round, seed };
      return { state: "ALIVE", label: `Through to the ${phaseInfo(last.round + 1).name}`, round: last.round + 1, seed };
    }
    if (last.round === FINAL_ROUND) return { state: "RUNNER_UP", label: "Runners-up", round: last.round, seed };
    return { state: "ELIMINATED", label: `Out in the ${name}`, round: last.round, seed };
  }

  if (qualifyingLocked) {
    return { state: "NOT_QUALIFIED", label: "Did not qualify", round: 1, seed: null };
  }
  if (standing?.runs) {
    return {
      state: "QUALIFYING",
      label: standing.qualified && standing.rank ? `Provisionally ${ordinal(standing.rank)}` : "Qualifying",
      round: 1,
      seed: null,
    };
  }
  return { state: "REGISTERED", label: "Yet to run", round: null, seed: null };
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

// --------------------------------------------------------- check-in states

export const INSPECTION_STATES = ["PENDING", "PASSED", "FAILED"] as const;
export type InspectionState = (typeof INSPECTION_STATES)[number];

export const INSPECTION_LABELS: Record<InspectionState, string> = {
  PENDING: "Not inspected",
  PASSED: "Passed inspection",
  FAILED: "Failed inspection",
};

export function parseInspection(value: unknown): InspectionState {
  const raw = String(value ?? "").toUpperCase();
  return (INSPECTION_STATES as readonly string[]).includes(raw) ? (raw as InspectionState) : "PENDING";
}

export const QUALIFYING_STATUSES = ["NOT_SET", "OPEN", "LOCKED"] as const;
export type QualifyingStatus = (typeof QUALIFYING_STATUSES)[number];

export const QUALIFYING_STATUS_LABELS: Record<QualifyingStatus, string> = {
  NOT_SET: "Format not set yet",
  OPEN: "Runs being recorded",
  LOCKED: "Locked, bracket drawn",
};

export function parseQualifyingStatus(value: unknown): QualifyingStatus {
  const raw = String(value ?? "").toUpperCase();
  return (QUALIFYING_STATUSES as readonly string[]).includes(raw) ? (raw as QualifyingStatus) : "NOT_SET";
}
