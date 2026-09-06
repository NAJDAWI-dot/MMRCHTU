import { seededRandom } from "@/lib/maze";

/**
 * The corridor that runs down the side of the homepage as you scroll.
 *
 * A single path in the same vocabulary the maze routes use — M, V and H only,
 * no curves — so it reads as a mouse working its way down a corridor rather
 * than as a decorative squiggle. Pure, so the geometry is testable without a
 * scroll position or a browser.
 */

/** Fixed, so the server and the browser draw the same corridor. */
export const DESCENT_SEED = 26_2026;

/** Lanes the corridor can sit in, as fractions of the strip's width. */
const LANES = [0.2, 0.5, 0.8] as const;

/**
 * A vertical corridor with `segments` jogs, in a `width` by `height` box.
 *
 * Each segment drops straight down and then steps sideways into a new lane,
 * never twice into the same one — a corridor that jogged back to where it
 * started would read as a wobble rather than as a turn.
 */
export function descentPath(segments: number, width: number, height: number): string {
  if (segments < 1 || width <= 0 || height <= 0) return "";

  const random = seededRandom(DESCENT_SEED);
  const step = height / segments;

  let lane = 1;
  const parts = [`M ${(LANES[lane]! * width).toFixed(1)} 0`];

  for (let i = 1; i <= segments; i += 1) {
    parts.push(`V ${(step * i).toFixed(1)}`);

    // The last segment runs straight off the bottom rather than turning, so
    // the corridor leaves the frame instead of stopping against it.
    if (i === segments) break;

    const choices = LANES.map((_, at) => at).filter((at) => at !== lane);
    lane = choices[Math.floor(random() * choices.length)] ?? lane;
    parts.push(`H ${(LANES[lane]! * width).toFixed(1)}`);
  }

  return parts.join(" ");
}

/**
 * How far down the page the reader is, from 0 to 1.
 *
 * Measured against the scrollable distance rather than the document height:
 * the last viewport of a page cannot be scrolled past, so dividing by the full
 * height would mean the corridor never finished on any page — the marker would
 * stop short of the bottom by exactly one screen, every time.
 *
 * A page shorter than the viewport has nothing to scroll and is complete at
 * once, rather than dividing by zero.
 */
export function descentProgress(scrollY: number, documentHeight: number, viewportHeight: number): number {
  const scrollable = documentHeight - viewportHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}
