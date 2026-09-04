/**
 * The words on the admin dashboard's greeting.
 *
 * Pure and free of React, Prisma and the DOM, so the awkward parts — the hour
 * boundaries, the plurals, and the two different reasons a previous login can
 * be missing — are testable directly rather than through a rendered page.
 *
 * Deliberately says nothing it cannot support. A greeting that guessed at
 * "last here 3 hours ago" when the column is empty would be worse than a
 * greeting that simply stops after the name.
 */

/** How new an account can be and still be greeted as new. */
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Three buckets covering all twenty-four hours.
 *
 * Evening deliberately runs through the small hours rather than leaving 02:00
 * to fall through to "morning", which is the boundary bug every one of these
 * functions has.
 */
export function timeOfDay(now: Date): "morning" | "afternoon" | "evening" {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** How long ago, in the words a person would use. */
export function relativeTime(from: Date, now: Date): string {
  const elapsed = now.getTime() - from.getTime();

  // A clock skew or a clock change can put the stored time slightly ahead of
  // now. "in -2 minutes" is not worth handling as a special case; treat
  // anything at or before the present moment as just now.
  if (elapsed < MINUTE) return "just now";

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(elapsed / DAY);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export interface AdminGreetingText {
  /** "Good evening, hatem." */
  headline: string;
  /** The line under it, or null when nothing true can be said. */
  detail: string | null;
}

export function adminGreeting(
  username: string,
  previousLoginAt: Date | null,
  createdAt: Date,
  now: Date = new Date(),
): AdminGreetingText {
  const headline = `Good ${timeOfDay(now)}, ${username}.`;

  if (previousLoginAt) {
    return { headline, detail: `You were last here ${relativeTime(previousLoginAt, now)}.` };
  }

  // No previous login recorded, which happens for two different reasons: the
  // account has genuinely never signed in before, or its row predates the
  // column. The account's age is what separates them — a day-old account is
  // the first case, a months-old one is the second — and only the first has
  // anything worth saying.
  if (now.getTime() - createdAt.getTime() < NEW_ACCOUNT_WINDOW_MS) {
    return { headline, detail: "Welcome aboard — this is your first time here." };
  }

  return { headline, detail: null };
}
