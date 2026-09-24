import { NextResponse } from "next/server";
import { requireSectionApi } from "@/lib/admin-access";
import { phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { toCsv } from "@/lib/csv";
import { clockTime } from "@/lib/day-mode";
import { competitionDayKey, qualifyingSlot } from "@/lib/match-results";
import { prisma } from "@/lib/prisma";
import { scoreSheet } from "@/lib/score-sheet";
import { SCORE_HEADERS, STANDINGS_HEADERS, TIMING_HEADERS, scoreRows, standingsRow, transferFileName } from "@/lib/score-transfer";
import { getCompetitionDayConfig } from "@/lib/site-config";

/**
 * The scoring desk's files: ?file=scores (every run, for importing back),
 * standings (the qualifying table) or timings (qualifying slots and knockout
 * match times, for importing back). Scoring admins only, and never cached, so a
 * download is always as of now.
 */
export const dynamic = "force-dynamic";

type Kind = "scores" | "standings" | "timings";

export async function GET(request: Request) {
  const admin = await requireSectionApi("/day/hq/scoring");
  if (!admin) return new NextResponse("Not found", { status: 404 });

  const param = new URL(request.url).searchParams.get("file");
  const kind: Kind = param === "standings" || param === "timings" ? param : "scores";
  const [state, config, sheets] = await Promise.all([
    loadCompetition(),
    getCompetitionDayConfig(),
    prisma.qualifyingRun.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const day = competitionDayKey(config.eventDate);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const byOrder = [...state.competitors].sort(
    (a, b) => (a.runOrder ?? 9999) - (b.runOrder ?? 9999) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );

  let csv: string;
  if (kind === "standings") {
    csv = toCsv(STANDINGS_HEADERS, state.table.map(standingsRow));
  } else if (kind === "timings") {
    const qualifying = byOrder
      .filter((team) => team.runOrder !== null || team.slotTime)
      .map((team) => {
        const slot = qualifyingSlot(team, config, day);
        return [phaseInfo(1).name, "", team.runOrder ?? "", team.id, team.name, "", slot ? clockTime(slot) : "", ""];
      });
    const knockout = state.bracket
      .filter((match) => !match.void)
      .map((match) => [
        phaseInfo(match.round).name,
        match.slot + 1,
        "",
        match.teamAId ?? "",
        nameOf(match.teamAId),
        nameOf(match.teamBId),
        match.scheduledAt ? clockTime(match.scheduledAt) : "",
        match.arena,
      ]);
    csv = toCsv(TIMING_HEADERS, [...qualifying, ...knockout]);
  } else {
    const sheetOf = new Map(sheets.map((row) => [row.registrationId, row]));
    const qualifying = byOrder.flatMap((team) => {
      const row = sheetOf.get(team.id);
      if (!row) return [];
      const sheet = scoreSheet({ times: row.runTimes, remaining: row.remaining, log: row.runLog });
      return scoreRows(1, null, team, sheet, team.standing?.best ?? row.score, row.note);
    });
    const knockout = state.bracket.flatMap((match) =>
      [
        { id: match.teamAId, score: match.scoreA, sheet: scoreSheet({ times: match.timesA, remaining: match.remainingA, log: match.runLogA }) },
        { id: match.teamBId, score: match.scoreB, sheet: scoreSheet({ times: match.timesB, remaining: match.remainingB, log: match.runLogB }) },
      ]
        .filter((side) => side.id && side.sheet.log.length)
        .flatMap((side) => scoreRows(match.round, match.slot + 1, { id: side.id!, name: nameOf(side.id) }, side.sheet, side.score)),
    );
    csv = toCsv(SCORE_HEADERS, [...qualifying, ...knockout]);
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${transferFileName(kind, day)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
