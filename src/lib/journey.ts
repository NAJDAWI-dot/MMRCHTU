/**
 * The journey: a guided walk through mmrchtu.tech as it was, in two eras.
 * Registration season, rendered as it stood with the form open and the clock
 * counting down, and competition day, captured live from the day site.
 *
 * Each stop is a full-page capture with a few notes pinned to it. The stops
 * themselves are generated (src/lib/journey-stops.ts); this is the vocabulary
 * and the arithmetic, free of React so it can be tested.
 */

export type JourneyEra = "registration" | "day";

export interface JourneyImage {
  src: string;
  width: number;
  height: number;
}

export interface JourneyNote {
  title: string;
  body: string;
  /** Where the note points, as fractions of the desktop capture. */
  x: number;
  y: number;
  /** The same on the phone capture, or null when it falls below it. */
  phoneY: number | null;
}

export interface JourneyStop {
  id: string;
  era: JourneyEra;
  path: string;
  /** Whether the page still answers at its address, so the tour can link to it. */
  live: boolean;
  title: string;
  intro: string;
  image: JourneyImage;
  /** A phone-width capture, or null when the page was only ever on a wall. */
  phone: JourneyImage | null;
  notes: JourneyNote[];
}

export const JOURNEY_ERAS: readonly { id: JourneyEra; title: string; when: string; lead: string }[] = [
  {
    id: "registration",
    title: "Registration season",
    when: "July to October 2026",
    lead: "Three months of signing teams up, explaining the rules and keeping people busy until the day.",
  },
  {
    id: "day",
    title: "Competition day",
    when: "Monday 5 October 2026",
    lead: "The day itself, when the site turned into a live board for the hall and every phone in it.",
  },
];

/** A place in the tour: which stop, and which of its notes. */
export interface TourPlace {
  stop: number;
  note: number;
}

/** The next place, note by note, then stop by stop; null at the very end. */
export function nextPlace(stops: readonly JourneyStop[], place: TourPlace): TourPlace | null {
  const stop = stops[place.stop];
  if (!stop) return null;
  if (place.note < stop.notes.length - 1) return { stop: place.stop, note: place.note + 1 };
  if (place.stop < stops.length - 1) return { stop: place.stop + 1, note: 0 };
  return null;
}

/** The place before, the last note of the previous stop when stepping back over a stop; null at the start. */
export function previousPlace(stops: readonly JourneyStop[], place: TourPlace): TourPlace | null {
  if (place.note > 0) return { stop: place.stop, note: place.note - 1 };
  if (place.stop > 0) {
    const before = stops[place.stop - 1]!;
    return { stop: place.stop - 1, note: Math.max(0, before.notes.length - 1) };
  }
  return null;
}

/**
 * How far to scroll a capture so a note sits a third of the way down the
 * frame: high enough to read what is under it, low enough to see what led to
 * it. Clamped to the capture, in pixels of the rendered image.
 */
export function scrollFor(fraction: number, imageHeight: number, frameHeight: number): number {
  const target = fraction * imageHeight - frameHeight / 3;
  return Math.round(Math.max(0, Math.min(imageHeight - frameHeight, target)));
}
