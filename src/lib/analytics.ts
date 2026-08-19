/**
 * Shaping helpers for the admin analytics page.
 *
 * Free of Prisma and of React: the page runs the queries and hands plain rows
 * in, so the counting, grouping and bucketing can be tested directly. The
 * numbers here decide what the organisers believe about turnout, so "it looked
 * about right on screen" is not good enough.
 *
 * Everything is derived from the real tables. The Counter rows are not used:
 * only `registrations` was ever incremented, and counting the table is both
 * accurate and cheap at this scale.
 */

export interface Tally {
  label: string;
  value: number;
}

/**
 * Counts rows by a key, largest first.
 *
 * Blank and missing keys collapse into one bucket rather than being dropped —
 * a field nobody filled in is a real finding about the form, not a row to hide.
 */
export function tally<T>(
  rows: readonly T[],
  key: (row: T) => string | null | undefined,
  options: { labels?: Record<string, string>; emptyLabel?: string } = {},
): Tally[] {
  const { labels = {}, emptyLabel = "Not given" } = options;
  const counts = new Map<string, number>();

  for (const row of rows) {
    const raw = key(row);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    const bucket = trimmed === "" ? emptyLabel : (labels[trimmed] ?? trimmed);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    // Ties broken alphabetically so the order is stable between page loads
    // rather than depending on Map insertion order.
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/**
 * Keeps the largest `n` buckets and rolls the rest into one.
 *
 * A university list with forty single-entry rows tells you less than the top
 * five plus a remainder does.
 */
export function topN(tallies: readonly Tally[], n: number, restLabel = "Other"): Tally[] {
  if (tallies.length <= n) return [...tallies];
  const head = tallies.slice(0, n);
  const rest = tallies.slice(n).reduce((sum, t) => sum + t.value, 0);
  return rest > 0 ? [...head, { label: restLabel, value: rest }] : head;
}

/** Whole-percent share, guarding the empty case so it reads 0 rather than NaN. */
export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export interface DayBucket {
  /** Local calendar day, as YYYY-MM-DD. */
  key: string;
  /** Short label for the axis, e.g. "19 Aug". */
  label: string;
  count: number;
}

/** Local calendar day, not UTC — organisers read these against their own dates. */
function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Buckets timestamps into the last `days` calendar days, ending today.
 *
 * Days with nothing in them are still returned, so a quiet week reads as a
 * flat run of zeros rather than silently disappearing from the chart.
 */
export function dailyCounts(dates: readonly Date[], days: number, now: Date = new Date()): DayBucket[] {
  const buckets = new Map<string, number>();
  const order: DayBucket[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d);
    buckets.set(key, 0);
    order.push({
      key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      count: 0,
    });
  }

  for (const date of dates) {
    const key = dayKey(date);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return order.map((b) => ({ ...b, count: buckets.get(b.key) ?? 0 }));
}

/**
 * Distribution of team sizes, as "1 member", "2 members"...
 *
 * Sorted by size rather than by count, because the shape of the distribution
 * is the point — a spike at 1 means something different from a spike at 4.
 */
export function teamSizeSpread(sizes: readonly number[]): Tally[] {
  const counts = new Map<number, number>();
  for (const size of sizes) counts.set(size, (counts.get(size) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, value]) => ({ label: `${size} member${size === 1 ? "" : "s"}`, value }));
}

/** Mean team size to one decimal, or 0 when nothing has been registered yet. */
export function averageTeamSize(memberCount: number, teamCount: number): number {
  if (teamCount <= 0) return 0;
  return Math.round((memberCount / teamCount) * 10) / 10;
}

/** Human labels for the statuses stored as bare strings on Registration. */
export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  WAITLISTED: "Waitlisted",
  CANCELLED: "Cancelled",
};

/** Human labels for the IEEE membership tiers, which drive the entry fee. */
export const IEEE_STATUS_LABELS: Record<string, string> = {
  IEEE_RAS_MEMBER: "IEEE RAS member",
  IEEE_MEMBER: "IEEE member",
  NON_MEMBER: "Non-member",
};

/** Human labels for the two Pac Mouse boards. */
export const GAME_MODE_LABELS: Record<string, string> = {
  classic: "Classic",
  firstperson: "First person",
};

/**
 * Orders a tally by a fixed sequence rather than by size.
 *
 * Statuses have a natural order (pending before confirmed before cancelled)
 * that a size sort would scramble differently on every page load. Buckets not
 * in the sequence keep their relative order at the end, so an unexpected
 * status value shows up instead of vanishing.
 */
export function orderBy(tallies: readonly Tally[], sequence: readonly string[]): Tally[] {
  const rank = new Map(sequence.map((label, i) => [label, i]));
  return [...tallies].sort((a, b) => {
    const ra = rank.get(a.label) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.label) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || b.value - a.value;
  });
}
