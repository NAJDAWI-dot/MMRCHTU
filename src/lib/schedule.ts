/**
 * Turning a list of dated events into a timeline that knows where "now" is.
 *
 * The schedule page listed events with their dates and nothing else, which
 * makes the reader do the arithmetic: is that one past? which is next? how long
 * have I got? All of that is derivable, so it is derived here.
 *
 * Free of React and of the clock — every function takes `now` explicitly, the
 * same arrangement as `countdown.ts`, so "the day of an event" and "one second
 * past midnight after it" are testable without waiting for either.
 */

export interface ScheduleItemInput {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
}

/**
 * Where an event sits relative to now.
 *
 * `today` is deliberately separate from `now`: an event with no end time is not
 * "happening" at any particular minute, but it is still the thing occupying the
 * day, and reading "passed" beside something happening this afternoon would be
 * wrong.
 */
export type ScheduleState = "past" | "now" | "today" | "next" | "upcoming";

export interface ScheduleItem extends ScheduleItemInput {
  state: ScheduleState;
  /** Human phrase for when it is, e.g. "in 3 days" or "2 weeks ago". */
  when: string;
  /** Whole days from today. Negative once past. */
  daysAway: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Midnight local time, so "days away" counts sleeps rather than 24-hour blocks. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Whole days between two dates, counted by calendar day.
 *
 * An event at 23:00 tonight and one at 01:00 tomorrow are a day apart even
 * though only two hours separate them — which is what a reader means by "days".
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Whether the event is running right now.
 *
 * Without an end time an event is treated as lasting an hour: long enough that
 * a schedule entry does not flick from "next" to "passed" the instant its
 * start time ticks over, which looks broken to anyone watching on the day.
 */
export function isHappeningNow(item: ScheduleItemInput, now: Date): boolean {
  const start = item.startsAt.getTime();
  const end = item.endsAt ? item.endsAt.getTime() : start + HOUR;
  return now.getTime() >= start && now.getTime() < end;
}

/** "in 3 days", "today", "2 weeks ago" — the phrase a person would use. */
export function relativeWhen(target: Date, now: Date): string {
  const days = daysBetween(now, target);

  if (days === 0) {
    const diff = target.getTime() - now.getTime();
    if (diff < -HOUR) return "earlier today";
    if (diff < 0) return "just now";
    if (diff < MINUTE) return "any moment";
    if (diff < HOUR) {
      const mins = Math.round(diff / MINUTE);
      return `in ${mins} minute${mins === 1 ? "" : "s"}`;
    }
    const hours = Math.round(diff / HOUR);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";

  const ahead = days > 0;
  const n = Math.abs(days);
  const phrase =
    n < 14
      ? `${n} days`
      : n < 60
        ? `${Math.round(n / 7)} weeks`
        : `${Math.round(n / 30)} months`;

  return ahead ? `in ${phrase}` : `${phrase} ago`;
}

/**
 * Annotates each event with its state and a readable "when".
 *
 * Exactly one event is ever marked `next` — the first one still to come — so
 * the page can single it out without the caller scanning for it.
 */
export function buildTimeline(
  items: ScheduleItemInput[],
  now: Date = new Date(),
): ScheduleItem[] {
  const ordered = [...items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  // The first event that has not finished. Everything before it is past, and it
  // alone gets `next` — later ones are merely `upcoming`.
  const nextIndex = ordered.findIndex(
    (item) => item.startsAt.getTime() > now.getTime() || isHappeningNow(item, now),
  );

  return ordered.map((item, index) => {
    const happening = isHappeningNow(item, now);
    const sameDay = isSameDay(item.startsAt, now);
    const past = !happening && item.startsAt.getTime() <= now.getTime();

    const state: ScheduleState = happening
      ? "now"
      : past
        ? "past"
        : sameDay
          ? "today"
          : index === nextIndex
            ? "next"
            : "upcoming";

    return {
      ...item,
      state,
      when: relativeWhen(item.startsAt, now),
      daysAway: daysBetween(now, item.startsAt),
    };
  });
}

/**
 * How far through the schedule we are, 0–100.
 *
 * Measured by events completed rather than by elapsed time: the gaps between
 * dates are wildly uneven, so a time-based bar would sit near zero for months
 * and then leap, which tells the reader less than "three of seven done".
 */
export function scheduleProgress(items: ScheduleItem[]): number {
  if (!items.length) return 0;
  const done = items.filter((item) => item.state === "past").length;
  return Math.round((done / items.length) * 100);
}

/** The event to draw attention to: the one running now, else the next one. */
export function focusEvent(items: ScheduleItem[]): ScheduleItem | null {
  return (
    items.find((item) => item.state === "now") ??
    items.find((item) => item.state === "today") ??
    items.find((item) => item.state === "next") ??
    null
  );
}

export const STATE_LABELS: Record<ScheduleState, string> = {
  past: "Done",
  now: "Happening now",
  today: "Today",
  next: "Up next",
  upcoming: "Upcoming",
};
