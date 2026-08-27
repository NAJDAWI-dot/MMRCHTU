/**
 * Countdown arithmetic for competition day.
 *
 * Free of React and of the clock: every function takes `now` explicitly rather
 * than reading it. Time-dependent code that calls `Date.now()` internally can
 * only be tested by waiting, which is why the interesting cases here — the
 * final second, the moment it hits zero, a date already past — are testable at
 * all.
 */

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds left, never negative. */
  totalMs: number;
  /** The target has arrived or passed. */
  done: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Splits the gap between now and the target into whole units.
 *
 * Clamps at zero rather than going negative: a passed date should read as
 * "it's happening" everywhere, and no caller should have to remember to guard
 * against negative days.
 */
export function remainingUntil(target: Date, now: Date = new Date()): Remaining {
  const totalMs = Math.max(0, target.getTime() - now.getTime());

  return {
    days: Math.floor(totalMs / DAY),
    hours: Math.floor((totalMs % DAY) / HOUR),
    minutes: Math.floor((totalMs % HOUR) / MINUTE),
    seconds: Math.floor((totalMs % MINUTE) / SECOND),
    totalMs,
    done: totalMs === 0,
  };
}

/**
 * Whether seconds are worth showing. They always are.
 *
 * This used to hide them until the last day, on the reasoning that a ticking
 * seconds digit three months out is noise. In practice it made the opposite
 * point: a clock whose largest three units all change at most once an hour is
 * indistinguishable from a static graphic, and the one live thing on the
 * homepage read as decoration. The seconds digit is what tells a visitor the
 * page is counting.
 *
 * Kept as a function rather than deleted so callers keep asking rather than
 * assuming, and so hiding them again is a one-line change here.
 */
export function showsSeconds(_remaining: Remaining): boolean {
  return true;
}

/**
 * How often the display needs to change, in ms.
 *
 * Once a second, since seconds are always on screen. A re-render a second is
 * cheap — the component renders four numbers — and anything slower would leave
 * the seconds digit visibly skipping values.
 */
export function tickIntervalMs(remaining: Remaining): number {
  return showsSeconds(remaining) ? SECOND : MINUTE;
}

/** Zero-padded, so the digits do not jitter in width as they count down. */
export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export interface CountdownUnit {
  value: string;
  label: string;
}

/**
 * The units to display, largest meaningful first.
 *
 * Days are dropped once there are none left, so the last day reads
 * "04 : 12 : 30" rather than leading with a permanent "00 days".
 */
export function countdownUnits(remaining: Remaining): CountdownUnit[] {
  const units: CountdownUnit[] = [];

  if (remaining.days > 0) {
    units.push({ value: String(remaining.days), label: remaining.days === 1 ? "day" : "days" });
  }
  units.push({ value: pad(remaining.hours), label: remaining.hours === 1 ? "hour" : "hours" });
  units.push({
    value: pad(remaining.minutes),
    label: remaining.minutes === 1 ? "minute" : "minutes",
  });
  if (showsSeconds(remaining)) {
    units.push({
      value: pad(remaining.seconds),
      label: remaining.seconds === 1 ? "second" : "seconds",
    });
  }

  return units;
}

/**
 * A single sentence for screen readers and for reduced-motion visitors.
 *
 * A row of ticking digits is meaningless read aloud one at a time, and an
 * aria-live region that updates every second is actively hostile — so the
 * digits are hidden from assistive tech and this is announced instead.
 */
export function countdownSentence(remaining: Remaining): string {
  if (remaining.done) return "Competition day is here.";

  const parts: string[] = [];
  if (remaining.days > 0) parts.push(`${remaining.days} day${remaining.days === 1 ? "" : "s"}`);
  if (remaining.hours > 0) parts.push(`${remaining.hours} hour${remaining.hours === 1 ? "" : "s"}`);
  // Minutes are worth saying only when they are the largest unit or close to it;
  // "3 months and 12 minutes" tells nobody anything useful.
  if (remaining.days === 0 && remaining.minutes > 0) {
    parts.push(`${remaining.minutes} minute${remaining.minutes === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return "Less than a minute until competition day.";

  return `${listJoin(parts)} until competition day.`;
}

/** "a", "a and b", "a, b and c" — Oxford-comma-free, matching British usage. */
function listJoin(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]!}`;
}

/**
 * Whether a countdown should be shown at all.
 *
 * Hidden once the event is more than a year out, which in practice only
 * happens when someone mistypes the year — a clock reading "412 days" is a
 * data-entry bug on display, not a feature.
 */
export function shouldShowCountdown(target: Date | null | undefined, now: Date = new Date()): boolean {
  if (!target) return false;
  const ms = target.getTime() - now.getTime();
  return ms > 0 && ms < 366 * DAY;
}
