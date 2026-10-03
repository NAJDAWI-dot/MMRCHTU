import type { Metadata } from "next";
import { requireDayViewer } from "@/lib/day-access";
import { DAY_TIME_ZONE, dayKey, postedAgo } from "@/lib/day-mode";
import { loadDayPhotos } from "@/lib/day-photos";
import { loadSlideSponsors } from "@/lib/day-sponsors";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { TestingScreen } from "./TestingScreen";

export const revalidate = 30;
export const metadata: Metadata = { title: "Testing day screen", robots: { index: false } };

/**
 * Where testing day happens. Its own place, not the competition day venue in
 * the settings: the two days are not held in the same room.
 */
const VENUE = { place: "Building 23C", area: "Orange Village · Al-Hussein Technical University" };

/** How many photos the photo slide goes through, newest first. */
const SHOWN = 12;

/** Whole days from one Amman date to another, by the calendar rather than the clock. */
function daysBetween(from: Date, to: Date): number {
  const utc = (date: Date) => Date.parse(`${dayKey(date)}T00:00:00Z`);
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** "In 3 days" and the date, or null once it has come or when no date is set. */
function countdown(eventDate: Date | null, now: Date): { value: string; label: string } | null {
  if (!eventDate) return null;
  const days = daysBetween(now, eventDate);
  if (days < 1) return null;
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: DAY_TIME_ZONE }).format(eventDate);
  return { value: days === 1 ? "Tomorrow" : `In ${days} days`, label: date };
}

/**
 * The testing day on a projector: a title slide, the photos from the hall as
 * they are taken, and the sponsors. Photos come from the Photos desk in HQ and
 * sponsors from the Sponsors desk, the same ones the hall screen shows. Same
 * access as the hall screen.
 */
export default async function TestingScreenPage() {
  await requireDayViewer();
  const [config, gallery, sponsors] = await Promise.all([getCompetitionDayConfig(), loadDayPhotos(SHOWN), loadSlideSponsors()]);
  const now = new Date();

  return (
    <TestingScreen
      today={new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: DAY_TIME_ZONE }).format(now)}
      venue={VENUE}
      countdown={countdown(config.eventDate, now)}
      count={gallery.count}
      sponsors={sponsors}
      photos={gallery.photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        posted: postedAgo(photo.createdAt, now),
      }))}
    />
  );
}
