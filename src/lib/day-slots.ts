import { DAY_TIME_ZONE, dayKey, runningDayKey } from "@/lib/day-mode";
import type { ScheduleItemInput } from "@/lib/schedule";

/**
 * The competition day's running order, as written on the Competition Day
 * screen: clock times on the day ("09:00"), a title, a place, a line of detail.
 *
 * Times are stored as the clock reads in Amman rather than as instants, because
 * that is how a running order is written and read, and because the date is
 * already set once, on the competition itself. The two are put together here.
 *
 * Pure, so the parsing and the arithmetic are tested.
 */

export interface SlotLike {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  detail: string;
  sortOrder?: number;
}

/** "09:00" from "9", "9:00", "09.00", "0900" or "9:00 am". Null otherwise. */
export function parseClock(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm)?$/.exec(raw);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const half = match[3];
  if (half) {
    if (hours < 1 || hours > 12) return null;
    if (half === "pm" && hours !== 12) hours += 12;
    if (half === "am" && hours === 12) hours = 0;
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * The instant a clock time happens on a given day in Amman.
 *
 * Worked out rather than assuming an offset: the guess is corrected by however
 * far Amman's clock reads from it, so it stays right whatever the offset is.
 */
export function zonedInstant(day: string, clock: string, timeZone: string = DAY_TIME_ZONE): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = clock.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess - (shown - guess));
}

const byTime = (a: SlotLike, b: SlotLike) =>
  a.startTime.localeCompare(b.startTime) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

/**
 * The running order as timeline events on the competition's date, or on the
 * running day if no date is set yet. A line with no end runs until the next
 * one starts, so "now" moves along the list the way the day does.
 */
export function slotsToEvents(slots: SlotLike[], eventDate: Date | null, now: Date): ScheduleItemInput[] {
  const day = eventDate ? dayKey(eventDate) : runningDayKey(now);
  const ordered = [...slots].sort(byTime);
  return ordered.map((slot, index) => {
    const startsAt = zonedInstant(day, slot.startTime);
    const next = ordered[index + 1];
    const endClock = slot.endTime || (next && next.startTime > slot.startTime ? next.startTime : "");
    return {
      id: slot.id,
      title: slot.title,
      description: slot.detail,
      location: slot.location || null,
      startsAt,
      endsAt: endClock ? zonedInstant(day, endClock) : null,
    };
  });
}

export interface ParsedSlot {
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  detail: string;
}

/**
 * A whole running order pasted in, one line each:
 *
 *     09:00 - 09:45 | Check-in | Main hall | Bring your robot and ID
 *     10:00 Opening
 *
 * Start time, optional end time, then the title; a place and a detail after
 * bars if wanted. Blank lines are skipped. Lines that do not start with a time
 * are reported by number rather than guessed at.
 */
export function parseSlotLines(text: string): { slots: ParsedSlot[]; bad: number[] } {
  const slots: ParsedSlot[] = [];
  const bad: number[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = /^(\S+?)(?:\s*(?:-|–|—|to)\s*(\S+?))?(?:\s*\|\s*|\s+)(.*)$/i.exec(trimmed);
    const start = match ? parseClock(match[1]) : null;
    const end = match?.[2] ? parseClock(match[2]) : "";
    if (!match || !start || end === null) {
      bad.push(index + 1);
      return;
    }
    const [title = "", location = "", ...rest] = match[3]!.replace(/^\|\s*/, "").split("|").map((part) => part.trim());
    if (!title) {
      bad.push(index + 1);
      return;
    }
    slots.push({
      startTime: start,
      endTime: end,
      title: title.slice(0, 120),
      location: location.slice(0, 80),
      detail: rest.join(" | ").slice(0, 400),
    });
  });
  return { slots, bad };
}

/** The running order written back out in the same shape, for editing as text. */
export function slotsToText(slots: SlotLike[]): string {
  return [...slots]
    .sort(byTime)
    .map((slot) =>
      [
        `${slot.startTime}${slot.endTime ? ` - ${slot.endTime}` : ""} | ${slot.title}`,
        slot.location || slot.detail ? slot.location : null,
        slot.detail || null,
      ]
        .filter((part) => part !== null)
        .join(" | "),
    )
    .join("\n");
}
