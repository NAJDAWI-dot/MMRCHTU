import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsCalendar } from "@/lib/ics";

/**
 * The whole schedule as a subscribable calendar.
 *
 * Distinct from the per-event download at /api/schedule/[id]/ics: that one
 * hands over a copy, and a copy stops being true the moment a time changes.
 * This URL is meant to be pasted into a calendar app as a subscription, so the
 * app comes back for it and a room change reaches everyone who subscribed.
 *
 * Lives at a path ending in .ics because several calendar clients — and every
 * "add by URL" box that guesses — key off the extension rather than the
 * Content-Type header.
 */

// Always read the current schedule. A cached rendering of a calendar that
// exists specifically to carry changes would defeat the point.
export const dynamic = "force-dynamic";

export async function GET() {
  const events = await prisma.scheduleEvent.findMany({ orderBy: { startsAt: "asc" } });

  return new NextResponse(buildIcsCalendar(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // `inline`, not `attachment`: a subscription is fetched by the calendar
      // app, and prompting it to save a file is the wrong shape entirely. The
      // filename is still supplied for the browsers that do download it.
      "Content-Disposition": 'inline; filename="mmrc26.ics"',
      // Short enough that an edit made an hour before the day still lands,
      // long enough that a few hundred subscribed clients polling on their own
      // schedules do not each reach the database.
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
