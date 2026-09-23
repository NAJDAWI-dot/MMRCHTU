import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { daySiteIsPublic } from "@/lib/day-access";
import { parseTone, sortAlerts, type DayAlert } from "@/lib/day-alerts";

/**
 * What the day site's frame needs on every page: the alerts that pop up and
 * sit in the top banner, and whether this is a private preview. Cached per
 * request so the layout and the page share it.
 */
export const loadDayShell = cache(async (): Promise<{ alerts: DayAlert[]; isPublic: boolean }> => {
  const [rows, isPublic] = await Promise.all([
    prisma.dayAnnouncement.findMany({
      where: { isPublished: true, isAlert: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, body: true, tone: true, updatedAt: true },
    }),
    daySiteIsPublic(),
  ]);

  const alerts = sortAlerts(
    rows.map((row) => ({
      id: row.id,
      title: row.title.trim(),
      body: row.body.trim(),
      tone: parseTone(row.tone),
      version: row.updatedAt.getTime(),
    })),
  );
  return { alerts, isPublic };
});
