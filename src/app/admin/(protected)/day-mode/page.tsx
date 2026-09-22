import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { LiveDot } from "@/components/day/LiveDot";
import { DAY_MODE_HIDDEN_PAGES, postedAgo, sortAnnouncements } from "@/lib/day-mode";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";
import { AddAnnouncementForm, DayModeSwitch, EditAnnouncementForm } from "./DayModeForms";

export const metadata: Metadata = {
  title: "Admin | Day Mode",
};

/**
 * The competition day switch, and the notices that go out on the day.
 *
 * Kept on its own screen rather than on Competition Day: that screen is the
 * page's copy, edited weeks ahead, and this is the thing someone at the desk
 * has open all afternoon. Mixing them would put a Save button that rewrites
 * the venue under the box where "round two is delayed" gets typed.
 */
export default async function AdminDayModePage() {
  const [config, rows] = await Promise.all([
    getCompetitionDayConfig(),
    prisma.dayAnnouncement.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const on = config.dayMode;
  const announcements = sortAnnouncements(rows);
  const showing = rows.filter((row) => row.isPublished).length;
  const now = new Date();

  return (
    <div>
      <AdminPageHeader
        title="Day Mode"
        subtitle="Turns mmrchtu.tech into the competition day site, and back again."
      />

      <Card className={`mt-6 ${on ? "border-ras-crimson/40 dark:border-mood-rose/40" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {on ? <LiveDot /> : null}
              {on ? "Day mode is on" : "Day mode is off"}
            </p>
            <p className="mt-2 max-w-xl text-sm text-ras-gray dark:text-white/70">
              {on
                ? "Everyone who opens mmrchtu.tech gets the day site. Register and Rules are hidden."
                : "Visitors get the normal site. Turn it on the evening before, not at the door."}
            </p>
          </div>
          <DayModeSwitch on={on} />
        </div>

        <ul className="mt-5 grid gap-2 border-t border-ras-gray/15 pt-4 text-sm text-ras-gray dark:border-white/10 dark:text-white/70 sm:grid-cols-2">
          <li>
            <strong className="text-[var(--color-fg)]">Homepage:</strong> the day site: on now, up next,
            announcements, the running order and the confirmed teams.
          </li>
          <li>
            <strong className="text-[var(--color-fg)]">Hidden while on:</strong>{" "}
            {DAY_MODE_HIDDEN_PAGES.join(" and ")}. You still see them while signed in.
          </li>
          <li>
            <strong className="text-[var(--color-fg)]">Registration:</strong> closed, including any
            form left open in a tab.
          </li>
          <li>
            <strong className="text-[var(--color-fg)]">Everything else:</strong> FAQ, Micro Mouse,
            Pac Mouse, Gallery and Schedule stay up.
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/day-preview" className="font-semibold text-accent underline-offset-2 hover:underline">
            Preview the day site →
          </Link>
          <Link
            href="/admin/competition-day"
            className="text-ras-gray underline-offset-2 hover:underline dark:text-white/65"
          >
            Edit the headline, date, venue and details
          </Link>
          <Link href="/admin/schedule" className="text-ras-gray underline-offset-2 hover:underline dark:text-white/65">
            Edit the running order
          </Link>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Post an announcement
        </h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
          Shows on the day site, newest first, with pinned ones above the rest. Phones left open on
          the page pick it up within a minute.
        </p>
        <AddAnnouncementForm />
      </Card>

      {announcements.length ? (
        <>
          <p className="mt-8 text-sm text-ras-gray dark:text-white/60">
            {announcements.length} announcement{announcements.length === 1 ? "" : "s"}, {showing} showing.
          </p>
          <div className="mt-3 space-y-4">
            {announcements.map((row) => (
              <Card key={row.id} className={row.isPinned ? "border-[#F2A900]/60" : ""}>
                <EditAnnouncementForm
                  row={row}
                  posted={`Posted ${postedAgo(row.createdAt, now)}${row.isPinned ? " · pinned" : ""}`}
                />
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
