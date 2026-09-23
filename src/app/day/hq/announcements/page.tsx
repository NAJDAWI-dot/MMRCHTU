import type { Metadata } from "next";
import { requireSection } from "@/lib/admin-access";
import { parseTone } from "@/lib/day-alerts";
import { postedAgo, sortAnnouncements } from "@/lib/day-mode";
import { prisma } from "@/lib/prisma";
import { DeskHead } from "../DeskKit";
import { AddAnnouncementForm, AnnouncementCard } from "./AnnouncementForms";

export const metadata: Metadata = { title: "Announcements" };

/**
 * News for the day site, and alerts: an alert pops up on every open screen,
 * then sits in the thin bar across the top until it is edited (it pops up
 * again) or cleared.
 */
export default async function AnnouncementsDeskPage() {
  await requireSection("/day/hq/announcements");
  const rows = await prisma.dayAnnouncement.findMany({ orderBy: { createdAt: "desc" } });
  const announcements = sortAnnouncements(rows);
  const showing = rows.filter((row) => row.isPublished).length;
  const alerts = rows.filter((row) => row.isPublished && row.isAlert).length;
  const now = new Date();

  return (
    <div className="space-y-8">
      <DeskHead
        icon="megaphone"
        title="Announcements"
        lead={`${showing} showing, ${alerts} as alert${alerts === 1 ? "" : "s"}. Open screens pick changes up within half a minute.`}
      />
      <section className="day-card p-5 sm:p-6">
        <h2 className="day-display text-2xl text-day-ink">Post</h2>
        <div className="mt-5">
          <AddAnnouncementForm />
        </div>
      </section>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        {announcements.map((row) => (
          <AnnouncementCard
            key={`${row.id}:${row.updatedAt.getTime()}`}
            row={{ id: row.id, title: row.title, body: row.body, tone: parseTone(row.tone), isAlert: row.isAlert, isPinned: row.isPinned, isPublished: row.isPublished }}
            posted={`Posted ${postedAgo(row.createdAt, now)}`}
          />
        ))}
      </ul>
    </div>
  );
}
