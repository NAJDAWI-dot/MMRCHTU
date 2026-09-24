import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/admin-access";
import { phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { scoreSheet } from "@/lib/score-sheet";
import { DeskHead } from "../../DeskKit";
import { TransferPanel } from "../TransferPanel";
import { BracketRounds } from "./BracketRounds";
import type { MatchRow, SideSheet } from "./MatchForm";

export const metadata: Metadata = { title: "Bracket" };

/** Phases two to six: every match, round by round, with both teams' sheets. */
export default async function BracketDeskPage() {
  await requireSection("/day/hq/scoring");
  const state = await loadCompetition();

  const sideSheet = (times: number[], remaining: number | null, log: unknown): SideSheet => {
    const sheet = scoreSheet({ times, remaining, log });
    return { log: sheet.log, runs: sheet.runs, failed: sheet.failed, official: sheet.official, remaining: sheet.remaining };
  };
  const nameOf = (id: string | null, fallback: string) => (id ? (state.byId.get(id)?.name ?? "Unknown team") : fallback);
  const rows: MatchRow[] = state.bracket.map((match) => ({
    id: match.id,
    round: match.round,
    label: `${phaseInfo(match.round).short} · Match ${match.slot + 1}`,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    teamA: nameOf(match.teamAId, match.round === 2 ? "Bye" : "Winner to come"),
    teamB: nameOf(match.teamBId, match.round === 2 ? "Bye" : "Winner to come"),
    seedA: match.seedA,
    seedB: match.seedB,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    sheetA: sideSheet(match.timesA, match.remainingA, match.runLogA),
    sheetB: sideSheet(match.timesB, match.remainingB, match.runLogB),
    winnerId: match.winnerId,
    status: match.status,
    arena: match.arena,
    time: match.scheduledAt ? clockTime(match.scheduledAt) : "",
    walkover: match.walkover,
    void: match.void,
    tied: match.tied,
  }));

  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");

  return (
    <div className="space-y-8">
      <DeskHead
        icon="bracket"
        title="Bracket"
        lead={
          state.drawn
            ? champion
              ? `Finished. ${champion.name} are the champions.`
              : "Open a match, write down each team's runs and whether they reached the centre, save. Winners move on by themselves."
            : "Not drawn yet."
        }
      />
      {!state.drawn ? (
        <p className="day-card p-6 text-day-muted">
          The bracket is drawn from the qualifying table.{" "}
          <Link href="/day/hq/scoring" className="font-semibold text-day-ink underline underline-offset-4">
            Close qualifying and draw it
          </Link>
          .
        </p>
      ) : (
        <BracketRounds rows={rows} />
      )}
      {state.drawn ? <TransferPanel drawn /> : null}
    </div>
  );
}
