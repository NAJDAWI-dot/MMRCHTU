/**
 * Day mode: the switch that turns mmrchtu.tech into the competition day site.
 *
 * Free of Prisma and of Next, like src/lib/pages.ts: everything here is a pure
 * function over plain values, so what the switch hides and how announcements
 * are ordered can be tested without a database or a request. The reads live in
 * src/lib/page-visibility.ts and src/lib/day-site.ts.
 *
 * The switch is read from the page cache, never from middleware. Middleware
 * runs on every request at the edge, and a database round trip there would
 * slow every page and let a database hiccup take the whole site down. Pages
 * already revalidate on a timer, and flipping the switch clears them all.
 */

/**
 * Pages that go dark while day mode is on.
 *
 * Nobody registers or rereads the rulebook in the hall, and a Register link on
 * the day invites a team to pay for a competition already under way. They come
 * back the moment the switch goes off. Signed-in admins still reach them by
 * URL, the same as any page hidden on the Pages tab.
 */
export const DAY_MODE_HIDDEN_PAGES = ["/register", "/rules"] as const;

/**
 * Menu entries that step aside in day mode without their pages going dark.
 *
 * The Competition Day page is what the homepage becomes, so a second link to
 * it is the same page twice. Open Day is a different event months earlier.
 * Both still answer at their URLs; they only leave the menu.
 */
export const DAY_MODE_MENU_OMITS = ["/competition-day", "/open-day"] as const;

/** Every href day mode takes out of the menu. */
export function dayModeMenuHidden(on: boolean): string[] {
  return on ? [...DAY_MODE_HIDDEN_PAGES, ...DAY_MODE_MENU_OMITS] : [];
}

/**
 * The hidden-page set, with day mode's pages added while it is on.
 *
 * A new set rather than the one passed in: the admin set is cached per request
 * and shared, and adding to it in place would leak day mode into whoever reads
 * it next.
 */
export function withDayMode(hidden: Iterable<string>, on: boolean): Set<string> {
  const next = new Set(hidden);
  if (on) for (const href of DAY_MODE_HIDDEN_PAGES) next.add(href);
  return next;
}

/** Long enough for "Team X, to the inspection desk", short enough for a phone. */
export const ANNOUNCEMENT_MAX = 280;

/**
 * An announcement body as it will be stored, or null when there is nothing.
 *
 * Runs of blank lines collapse to one, so a paste from a chat app does not open
 * a gap the size of the screen on a phone.
 */
export function parseAnnouncement(value: unknown): string | null {
  const body = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, ANNOUNCEMENT_MAX)
    .trim();
  return body ? body : null;
}

export interface AnnouncementLike {
  isPinned: boolean;
  createdAt: Date;
}

/** Pinned first, then newest first within each group. */
export function sortAnnouncements<T extends AnnouncementLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Where the day is read, whatever zone the server or the phone is in. */
export const DAY_TIME_ZONE = "Asia/Amman";

/** "14:05", in Amman, from any Date. */
export function clockTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DAY_TIME_ZONE,
  }).format(date);
}

/** "2026-11-14", in Amman. Two moments share a day when these match. */
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: DAY_TIME_ZONE,
  }).format(date);
}

/**
 * How long ago an announcement went up, in the words a hall uses.
 *
 * Minutes up to an hour, then the clock time: "posted 3 hours ago" is a sum the
 * reader has to do, "at 11:40" is not.
 */
export function postedAgo(posted: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - posted.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (dayKey(posted) === dayKey(now)) return `at ${clockTime(posted)}`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DAY_TIME_ZONE,
  }).format(posted);
}

/**
 * Which competition day a moment belongs to.
 *
 * The calendar day, except that the small hours count as the night before: a
 * prize-giving running on past midnight is still that day's last event, not
 * the first of the next one. The line is drawn at 06:00 Amman, well after
 * anything on the day and well before anyone arrives the next morning.
 */
const DAY_ROLLS_OVER_AT_MS = 6 * 60 * 60 * 1000;

export function runningDayKey(date: Date): string {
  return dayKey(new Date(date.getTime() - DAY_ROLLS_OVER_AT_MS));
}

export interface DayEventLike {
  startsAt: Date;
}

/**
 * The events that belong on the day site's running order.
 *
 * The ones on the competition date when there is one, since the day site is
 * about that day and not the months of deadlines before it. With no date set,
 * or nothing scheduled on it, everything from today on, so the list is never
 * empty for a reason the reader cannot see.
 */
export function eventsForDay<T extends DayEventLike>(
  events: T[],
  eventDate: Date | null,
  now: Date,
): T[] {
  const ordered = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  if (eventDate) {
    const key = runningDayKey(eventDate);
    const onTheDay = ordered.filter((event) => runningDayKey(event.startsAt) === key);
    if (onTheDay.length) return onTheDay;
  }
  const today = runningDayKey(now);
  return ordered.filter((event) => runningDayKey(event.startsAt) >= today);
}
