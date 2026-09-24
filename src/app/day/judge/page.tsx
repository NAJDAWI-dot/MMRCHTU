import type { Metadata } from "next";
import { requireSection } from "@/lib/admin-access";
import { KNOCKOUT_ROUNDS, phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { loadQueue } from "@/lib/day-queue";
import { prisma } from "@/lib/prisma";
import { scoreSheet } from "@/lib/score-sheet";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { JudgeTablet, type JudgeData } from "./JudgeTablet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Judge", robots: { index: false } };

/**
 * The judge's tablet at the maze: the team (or the two teams) running now, the
 * eight-minute clock, and a run at a time with big buttons. It saves through
 * the same actions as the scoring desks, so a sheet is checked the same way
 * wherever it was written.
 */
export default async function JudgePage() {
  await requireSection("/day/judge");
  const [state, queue, config, sheets] = await Promise.all([
    loadCompetition(),
    loadQueue(),
    getCompetitionDayConfig(),
    prisma.qualifyingRun.findMany({ orderBy: { createdAt: "asc" }, select: { registrationId: true, runTimes: true, remaining: true, runLog: true, note: true } }),
  ]);
  const sheetOf = new Map(sheets.map((row) => [row.registrationId, row]));
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");

  const teams = state.competitors
    .filter((team) => team.eligible)
    .sort((a, b) => (a.runOrder ?? 9999) - (b.runOrder ?? 9999) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
    .map((team) => {
      const row = sheetOf.get(team.id);
      return {
        id: team.id,
        name: team.name,
        runOrder: team.runOrder,
        log: row ? scoreSheet({ times: row.runTimes, remaining: row.remaining, log: row.runLog }).log : [],
        note: row?.note ?? "",
        hasSheet: !!row,
      };
    });

  // The knockout: the round being played, live matches first, then the ones still to play.
  const currentRound = KNOCKOUT_ROUNDS.find((round) => state.bracket.some((m) => m.round === round && m.teamAId && m.teamBId && !m.winnerId && !m.walkover && !m.void));
  const matches = state.bracket
    .filter((m) => m.teamAId && m.teamBId && !m.walkover && !m.void && (m.round === currentRound || m.status === "LIVE"))
    .sort((a, b) => Number(b.status === "LIVE") - Number(a.status === "LIVE") || Number(!!a.winnerId) - Number(!!b.winnerId) || a.round - b.round || a.slot - b.slot)
    .map((m) => ({
      id: m.id,
      label: `${phaseInfo(m.round).name} · Match ${m.slot + 1}`,
      teamA: { id: m.teamAId!, name: nameOf(m.teamAId), log: scoreSheet({ times: m.timesA, remaining: m.remainingA, log: m.runLogA }).log },
      teamB: { id: m.teamBId!, name: nameOf(m.teamBId), log: scoreSheet({ times: m.timesB, remaining: m.remainingB, log: m.runLogB }).log },
      arena: m.arena,
      time: m.scheduledAt ? clockTime(m.scheduledAt) : "",
      decided: !!m.winnerId,
      live: m.status === "LIVE",
    }));

  const data: JudgeData = {
    mode: state.qualifyingStatus === "LOCKED" ? "knockout" : "qualifying",
    teams,
    onMaze: config.queueTeamId || "",
    onDeck: queue.queue.onDeck?.id ?? "",
    queueActive: queue.active,
    matches,
  };
  return <JudgeTablet data={data} />;
}
