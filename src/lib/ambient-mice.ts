/**
 * The mice that wander across the landing page.
 *
 * Free of React and the DOM, like the rest of `lib`, so the part that is easy
 * to get wrong — never showing the same thing twice in a row from an injected
 * source of randomness — is tested directly rather than by sitting on the
 * homepage with a stopwatch.
 *
 * Two things happen on their own timers: one mouse peeks in from an edge, and
 * one runs along the bottom after a piece of cheese. They are kept separate
 * rather than alternating out of one loop, because they are different lengths
 * and the offset between them is what stops both arriving at once.
 */

import { CHEDDAR_PORTRAITS } from "@/lib/celebration";

/** How often each kind of appearance happens. */
export const AMBIENT_INTERVAL_MS = 30_000;

/**
 * How long after arriving the first peek happens.
 *
 * Shorter than the interval on purpose. A visitor who reads the hero and
 * clicks Register is gone in under thirty seconds, and would never learn there
 * were mice at all; the cadence settles to AMBIENT_INTERVAL_MS afterwards.
 */
export const FIRST_PEEK_DELAY_MS = 8_000;

/** The chase starts later, so the first of each does not land together. */
export const FIRST_CHASE_DELAY_MS = 21_000;

/** How long a peek is on screen, start of the slide to end of it. */
export const PEEK_DURATION_MS = 5_600;

/** How long the chase takes to cross. */
export const CHASE_DURATION_MS = 7_400;

/** Where a mouse can appear from. */
export type AmbientSpot = "left" | "right" | "top-right" | "bottom-left" | "bottom-right";

export const AMBIENT_SPOTS: readonly AmbientSpot[] = [
  "left",
  "right",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type ChaseDirection = "rightward" | "leftward";

export interface AmbientPeek {
  /** Index into CHEDDAR_PORTRAITS. */
  portrait: number;
  spot: AmbientSpot;
}

export interface AmbientChase {
  portrait: number;
  direction: ChaseDirection;
}

/**
 * Picks one item using a value expected in [0, 1).
 *
 * Clamped for the same reason celebration.ts clamps: an out-of-range value
 * would index past the end and return undefined, which here means a mouse with
 * no picture sliding across the page.
 */
function pick<T>(items: readonly T[], value: number): T {
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999_999_999) : 0;
  return items[Math.floor(safe * items.length)]!;
}

/**
 * Picks from everything except what was used last time.
 *
 * "From different places" is the whole request, and a uniform choice over five
 * spots repeats about one time in five — often enough that a visitor watching
 * for a minute would see it. Excluding the previous value costs one line and
 * makes consecutive repeats impossible rather than merely unlikely.
 *
 * With nothing to exclude, or a list of one, it falls back to a plain pick.
 */
function pickDifferent<T>(items: readonly T[], value: number, previous: T | undefined): T {
  const choices = previous === undefined ? items : items.filter((item) => item !== previous);
  return pick(choices.length > 0 ? choices : items, value);
}

export function pickPeek(
  random: () => number = Math.random,
  previous?: AmbientPeek | null,
): AmbientPeek {
  const indexes = CHEDDAR_PORTRAITS.map((_, i) => i);
  return {
    portrait: pickDifferent(indexes, random(), previous?.portrait),
    spot: pickDifferent(AMBIENT_SPOTS, random(), previous?.spot),
  };
}

export function pickChase(
  random: () => number = Math.random,
  previous?: AmbientChase | null,
): AmbientChase {
  const indexes = CHEDDAR_PORTRAITS.map((_, i) => i);
  return {
    portrait: pickDifferent(indexes, random(), previous?.portrait),
    // Only two directions, so this alternates rather than randomising — with
    // pickDifferent over a pair, "not the last one" is the other one.
    direction: pickDifferent<ChaseDirection>(
      ["rightward", "leftward"],
      random(),
      previous?.direction,
    ),
  };
}
