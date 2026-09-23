/**
 * The hall screen's leaderboards for the knockout: the current round ranked
 * by match score, and the final placings once the final is decided.
 *
 * Qualifying has its own table (src/lib/bracket.ts standings); these fill the
 * same slot once the bracket is drawn. Free of Prisma and of Next so they can
 * be tested on their own.
 */

import { FINAL_ROUND } from "@/lib/bracket";

export interface BoardMatch {
  round: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: string;
  walkover: boolean;
  void: boolean;
}

export type RoundResult = "through" | "out" | "live" | "to-play";

export interface RoundRow {
  teamId: string;
  opponentId: string | null;
  score: number | null;
  result: RoundResult;
}

/**
 * Every team in a round, best match score first. Teams yet to play follow,
 * the ones on the maze before the rest. Byes are left out: a team that got
 * through without playing has no score to rank.
 */
export function roundLeaderboard(matches: readonly BoardMatch[], round: number): RoundRow[] {
  const rows: RoundRow[] = [];
  for (const match of matches) {
    if (match.round !== round || match.void || match.walkover) continue;
    const sides = [
      { teamId: match.teamAId, opponentId: match.teamBId, score: match.scoreA },
      { teamId: match.teamBId, opponentId: match.teamAId, score: match.scoreB },
    ];
    for (const side of sides) {
      if (!side.teamId) continue;
      const result: RoundResult = match.winnerId
        ? match.winnerId === side.teamId
          ? "through"
          : "out"
        : match.status === "LIVE"
          ? "live"
          : "to-play";
      rows.push({ teamId: side.teamId, opponentId: side.opponentId, score: side.score, result });
    }
  }
  const waiting = (row: RoundRow) => (row.result === "live" ? 1 : 2);
  return rows.sort((a, b) => {
    if (a.score !== null && b.score !== null) return b.score - a.score;
    if (a.score !== null) return -1;
    if (b.score !== null) return 1;
    return waiting(a) - waiting(b);
  });
}

export interface Placing {
  place: 1 | 2 | 3;
  teamId: string;
}

/**
 * The podium once the final is decided: the champion, the runner-up, and the
 * two beaten semi-finalists sharing third. Empty until there is a champion.
 */
export function finalPlacings(matches: readonly BoardMatch[]): Placing[] {
  const final = matches.find((match) => match.round === FINAL_ROUND && match.winnerId);
  if (!final?.winnerId) return [];
  const loserOf = (match: BoardMatch) => (match.winnerId === match.teamAId ? match.teamBId : match.teamAId);
  const placings: Placing[] = [{ place: 1, teamId: final.winnerId }];
  const runnerUp = loserOf(final);
  if (runnerUp) placings.push({ place: 2, teamId: runnerUp });
  for (const semi of matches.filter((match) => match.round === FINAL_ROUND - 1 && match.winnerId && !match.walkover)) {
    const third = loserOf(semi);
    if (third) placings.push({ place: 3, teamId: third });
  }
  return placings;
}
