import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { loadCompetition } from "@/lib/competition";
import { daySiteIsPublic } from "@/lib/day-access";
import { formatScore, phaseInfo } from "@/lib/bracket";
import { sortAnnouncements } from "@/lib/day-mode";

export interface TickerItem {
  id: string;
  kind: "result" | "notice";
  text: string;
}

/**
 * What the day site's frame needs on every page: the ticker and whether this is
 * a private preview. Cached per request so the layout and the page share it.
 */
export const loadDayShell = cache(async () => {
  const [state, announcements, isPublic] = await Promise.all([
    loadCompetition(),
    prisma.dayAnnouncement.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, body: true, isPinned: true, createdAt: true },
    }),
    daySiteIsPublic(),
  ]);

  const name = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const results: TickerItem[] = state.bracket
    .filter((match) => match.winnerId && match.teamAId && match.teamBId && !match.walkover)
    .sort((a, b) => b.round - a.round || a.slot - b.slot)
    .slice(0, 10)
    .map((match) => ({
      id: `r-${match.round}-${match.slot}`,
      kind: "result",
      text: `${phaseInfo(match.round).short} · ${name(match.teamAId)} ${formatScore(match.scoreA)}–${formatScore(match.scoreB)} ${name(match.teamBId)}`,
    }));
  const notices: TickerItem[] = sortAnnouncements(announcements).map((row) => ({
    id: `a-${row.id}`,
    kind: "notice",
    text: row.body.replace(/\s+/g, " "),
  }));

  return { ticker: [...notices.slice(0, 3), ...results, ...notices.slice(3)], isPublic };
});
