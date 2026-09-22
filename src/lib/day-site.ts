import { prisma } from "@/lib/prisma";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { hiddenPageHrefs } from "@/lib/page-visibility";
import { eventsForDay, sortAnnouncements } from "@/lib/day-mode";
import { buildTimeline, focusEvent, type ScheduleItem } from "@/lib/schedule";

export interface DayAnnouncementView {
  id: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
}

export interface DaySiteData {
  headline: string;
  intro: string;
  dateText: string;
  venue: string;
  details: string;
  eventDate: Date | null;
  /** The running order for the day, each event knowing where "now" is. */
  timeline: ScheduleItem[];
  /** Running now, or else the next thing to happen. */
  focus: ScheduleItem | null;
  /** The event after `focus`, when there is one. */
  after: ScheduleItem | null;
  announcements: DayAnnouncementView[];
  /** Confirmed teams only, by name. Nothing else about a team goes on here. */
  teams: { id: string; name: string }[];
  hidden: Set<string>;
  now: Date;
}

/**
 * Everything the day site shows, in one round of queries.
 *
 * Shared by the homepage in day mode and by the admin preview, so the preview
 * is the page and not a drawing of it.
 */
export async function loadDaySite(now: Date = new Date()): Promise<DaySiteData> {
  const [config, events, announcements, teams, hidden] = await Promise.all([
    getCompetitionDayConfig(),
    prisma.scheduleEvent.findMany({ orderBy: { startsAt: "asc" } }),
    prisma.dayAnnouncement.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, body: true, isPinned: true, createdAt: true },
    }),
    prisma.registration.findMany({
      where: { status: "CONFIRMED" },
      select: { id: true, teamName: true },
    }),
    hiddenPageHrefs(),
  ]);

  const timeline = buildTimeline(eventsForDay(events, config.eventDate, now), now);
  const focus = focusEvent(timeline);
  const after = focus ? (timeline[timeline.indexOf(focus) + 1] ?? null) : null;

  return {
    headline: config.headline,
    intro: config.intro,
    dateText: config.dateText,
    venue: config.venue,
    details: config.details,
    eventDate: config.eventDate,
    timeline,
    focus,
    after,
    announcements: sortAnnouncements(announcements),
    teams: teams
      .map((team) => ({ id: team.id, name: team.teamName.trim() }))
      .filter((team) => team.name)
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    hidden,
    now,
  };
}
