import { FINAL_ROUND, phaseInfo } from "@/lib/bracket";
import type { CompetitionState } from "@/lib/competition";
import type { LastReveal } from "@/lib/reveal";
import { formatPoints, formatTime } from "@/lib/score-sheet";
import { roundLeaderboard } from "@/lib/screen-boards";

/**
 * The hall screen's reveal: what the room sees the moment the organisers press
 * Reveal. Built from the public competition, after the reveal, so it can only
 * ever show what the pages now show too.
 */
export interface RevealShow {
  /** When it was revealed: each screen plays each reveal once. */
  id: string;
  kicker: string;
  title: string;
  /** ranking: best first, revealed from the bottom up. names: everyone at once, in a cascade. */
  mode: "ranking" | "names" | "champion";
  rows: { name: string; value: string; detail: string }[];
  champion?: { name: string; detail: string };
}

export function revealShow(state: CompetitionState, last: LastReveal | null): RevealShow | null {
  if (!last) return null;
  const id = String(last.at);
  const nameOf = (teamId: string | null) => (teamId ? (state.byId.get(teamId)?.name ?? "") : "");

  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");
  if (champion && (last.phase === "all" || (last.phase === FINAL_ROUND && last.kind === "advance"))) {
    const runnerUp = state.competitors.find((team) => team.journey.state === "RUNNER_UP");
    return {
      id,
      kicker: "MMRC 26",
      title: "The champions",
      mode: "champion",
      rows: [],
      champion: { name: champion.name, detail: runnerUp ? `Beat ${runnerUp.name} in the final` : "Winners of the final" },
    };
  }

  const qualifyingRanking = (): RevealShow | null => {
    const rows = state.table
      .filter((row) => row.rank !== null)
      .slice(0, 10)
      .map((row) => ({
        name: row.name,
        value: formatPoints(row.best),
        detail: row.runs ? `${row.runs} successful ${row.runs === 1 ? "run" : "runs"} · best ${formatTime(row.official)}` : "No run reached the centre",
      }));
    return rows.length ? { id, kicker: "Phase 1", title: "Qualifying results", mode: "ranking", rows } : null;
  };

  if (last.phase === "all" || last.phase === 1) {
    if (last.kind === "advance") {
      const through = state.table.filter((row) => row.qualified);
      const seedOf = (teamId: string) => state.byId.get(teamId)?.journey.seed ?? null;
      const rows = through
        .map((row) => ({ name: row.name, seed: seedOf(row.teamId) }))
        .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99) || a.name.localeCompare(b.name))
        .map((row) => ({ name: row.name, value: row.seed ? `Seed ${row.seed}` : "", detail: "" }));
      return rows.length ? { id, kicker: "Phase 1", title: "Through to the knockout", mode: "names", rows } : null;
    }
    return qualifyingRanking();
  }

  const round = last.phase;
  if (last.kind === "advance") {
    const rows = state.bracket
      .filter((match) => match.round === round && match.winnerId && !match.void)
      .map((match) => ({ name: nameOf(match.winnerId), value: "Through", detail: match.walkover ? "Bye" : "" }));
    const next = round < FINAL_ROUND ? phaseInfo(round + 1).name : "";
    return rows.length ? { id, kicker: phaseInfo(round).name, title: next ? `Through to the ${next}` : "Through", mode: "names", rows } : null;
  }
  const rows = roundLeaderboard(state.bracket, round)
    .filter((row) => row.score !== null)
    .slice(0, 10)
    .map((row) => ({ name: nameOf(row.teamId), value: formatPoints(row.score), detail: row.opponentId ? `v ${nameOf(row.opponentId)}` : "" }));
  return rows.length ? { id, kicker: phaseInfo(round).name, title: `${phaseInfo(round).name} results`, mode: "ranking", rows } : null;
}
