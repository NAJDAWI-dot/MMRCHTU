import { describe, expect, it } from "vitest";
import {
  AMBIENT_INTERVAL_MS,
  AMBIENT_SPOTS,
  CHASE_DURATION_MS,
  FIRST_CHASE_DELAY_MS,
  FIRST_PEEK_DELAY_MS,
  PEEK_DURATION_MS,
  pickChase,
  pickPeek,
} from "@/lib/ambient-mice";
import { CHEDDAR_PORTRAITS } from "@/lib/celebration";

/** Feeds the pickers a scripted sequence instead of real randomness. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("AMBIENT_SPOTS", () => {
  it("offers several places, or 'from different places' means nothing", () => {
    expect(AMBIENT_SPOTS.length).toBeGreaterThanOrEqual(4);
  });

  it("holds no duplicates", () => {
    expect(new Set(AMBIENT_SPOTS).size).toBe(AMBIENT_SPOTS.length);
  });
});

describe("pickPeek", () => {
  it("picks the drawing and the place independently", () => {
    // One call each, in order. Reading the same value twice would tie a given
    // mouse to a given corner forever.
    const peek = pickPeek(scripted(0, 0.99));
    expect(peek.portrait).toBe(0);
    expect(peek.spot).toBe(AMBIENT_SPOTS[AMBIENT_SPOTS.length - 1]);
  });

  it("never appears in the same place twice running", () => {
    // The point of the feature. A uniform choice over five spots repeats about
    // one time in five, which a visitor watching for a minute would notice.
    let previous = pickPeek(scripted(0, 0));
    for (let i = 0; i < 40; i++) {
      // Feeding 0 every time is the worst case: without the exclusion this
      // would return the same spot forever.
      const next = pickPeek(scripted(0, 0), previous);
      expect(next.spot).not.toBe(previous.spot);
      previous = next;
    }
  });

  it("never shows the same drawing twice running", () => {
    let previous = pickPeek(scripted(0, 0));
    for (let i = 0; i < 40; i++) {
      const next = pickPeek(scripted(0, 0), previous);
      expect(next.portrait).not.toBe(previous.portrait);
      previous = next;
    }
  });

  it("can still reach every place", () => {
    const seen = new Set(
      AMBIENT_SPOTS.map((_, i) => pickPeek(scripted(0, (i + 0.5) / AMBIENT_SPOTS.length)).spot),
    );
    expect(seen.size).toBe(AMBIENT_SPOTS.length);
  });

  it("always returns a drawing that exists", () => {
    // An index past the end would be a mouse with no picture sliding in.
    for (const value of [0, 0.999_999_999, 1, 1.5, -0.4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const peek = pickPeek(scripted(value));
      expect(CHEDDAR_PORTRAITS[peek.portrait]).toBeDefined();
      expect(AMBIENT_SPOTS).toContain(peek.spot);
    }
  });

  it("works with no previous appearance and no argument at all", () => {
    expect(AMBIENT_SPOTS).toContain(pickPeek().spot);
    expect(AMBIENT_SPOTS).toContain(pickPeek(Math.random, null).spot);
  });
});

describe("pickChase", () => {
  it("alternates direction, so the run does not always come from one side", () => {
    let previous = pickChase(scripted(0, 0));
    for (let i = 0; i < 10; i++) {
      const next = pickChase(scripted(0, 0), previous);
      expect(next.direction).not.toBe(previous.direction);
      previous = next;
    }
  });

  it("never shows the same drawing twice running", () => {
    let previous = pickChase(scripted(0, 0));
    for (let i = 0; i < 20; i++) {
      const next = pickChase(scripted(0, 0), previous);
      expect(next.portrait).not.toBe(previous.portrait);
      previous = next;
    }
  });

  it("always returns a drawing that exists and a real direction", () => {
    for (const value of [0, 1, -1, Number.NaN]) {
      const chase = pickChase(scripted(value));
      expect(CHEDDAR_PORTRAITS[chase.portrait]).toBeDefined();
      expect(["rightward", "leftward"]).toContain(chase.direction);
    }
  });
});

describe("timings", () => {
  it("puts each mouse away well before the next is due", () => {
    // Otherwise two of the same kind overlap and the page fills up with mice.
    expect(PEEK_DURATION_MS).toBeLessThan(AMBIENT_INTERVAL_MS);
    expect(CHASE_DURATION_MS).toBeLessThan(AMBIENT_INTERVAL_MS);
  });

  it("offsets the two kinds so they do not arrive together", () => {
    const gap = Math.abs(FIRST_CHASE_DELAY_MS - FIRST_PEEK_DELAY_MS);
    expect(gap).toBeGreaterThan(PEEK_DURATION_MS);
    // Both run on the same interval, so an offset that holds at the start holds
    // for every pair after it.
    expect(gap).toBeLessThan(AMBIENT_INTERVAL_MS);
  });

  it("shows the first mouse sooner than the steady cadence", () => {
    // A visitor who reads the hero and clicks Register is gone inside thirty
    // seconds and would otherwise never learn there were mice.
    expect(FIRST_PEEK_DELAY_MS).toBeLessThan(AMBIENT_INTERVAL_MS);
  });
});
