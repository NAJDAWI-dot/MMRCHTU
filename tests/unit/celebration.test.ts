import { describe, expect, it } from "vitest";
import {
  CHEDDAR_MOVES,
  CHEDDAR_PORTRAITS,
  CHEDDAR_QUIPS,
  CELEBRATION_FADE_MS,
  pickCelebration,
} from "@/lib/celebration";

/** Feeds pickCelebration a scripted sequence instead of real randomness. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("CHEDDAR_QUIPS", () => {
  it("has enough lines that two teams registering together rarely match", () => {
    expect(CHEDDAR_QUIPS.length).toBeGreaterThanOrEqual(10);
  });

  it("holds no duplicates", () => {
    expect(new Set(CHEDDAR_QUIPS).size).toBe(CHEDDAR_QUIPS.length);
  });

  it("has no empty or untrimmed lines", () => {
    for (const quip of CHEDDAR_QUIPS) {
      expect(quip.trim()).toBe(quip);
      expect(quip.length).toBeGreaterThan(0);
    }
  });
});

describe("CHEDDAR_MOVES", () => {
  it("holds no duplicates", () => {
    expect(new Set(CHEDDAR_MOVES).size).toBe(CHEDDAR_MOVES.length);
  });
});

describe("CHEDDAR_PORTRAITS", () => {
  it("offers more than one drawing, or there is nothing to vary", () => {
    expect(CHEDDAR_PORTRAITS.length).toBeGreaterThan(1);
  });

  it("points every drawing at a distinct file under public/", () => {
    const sources = CHEDDAR_PORTRAITS.map((p) => p.src);
    expect(new Set(sources).size).toBe(sources.length);
    for (const src of sources) {
      expect(src.startsWith("/brand/cheddar/")).toBe(true);
      // The raster copies, not the vectors beside them: 65KB against 900KB,
      // and the landing page now shows one every thirty seconds.
      expect(src.endsWith(".webp")).toBe(true);
    }
  });

  it("describes each drawing rather than repeating one label", () => {
    // Which one you got is the point of there being five, so the alt text has
    // to say which one it is.
    const alts = CHEDDAR_PORTRAITS.map((p) => p.alt);
    expect(new Set(alts).size).toBe(alts.length);
    for (const alt of alts) {
      expect(alt.trim()).toBe(alt);
      expect(alt.length).toBeGreaterThan(10);
    }
  });
});

describe("pickCelebration", () => {
  it("picks the quip, the move and the drawing independently", () => {
    // One call each, in order. Reading the same value three times would lock
    // move N and drawing N to quip N and quietly collapse the variety.
    const { quip, move, portrait } = pickCelebration(scripted(0, 0.99, 0));
    expect(quip).toBe(CHEDDAR_QUIPS[0]);
    expect(move).toBe(CHEDDAR_MOVES[CHEDDAR_MOVES.length - 1]);
    expect(portrait).toBe(CHEDDAR_PORTRAITS[0]);
  });

  it("can reach every drawing", () => {
    const seen = new Set<string>();
    for (let i = 0; i < CHEDDAR_PORTRAITS.length; i++) {
      // Third call is the drawing; the first two feed quip and move.
      seen.add(pickCelebration(scripted(0, 0, (i + 0.5) / CHEDDAR_PORTRAITS.length)).portrait.src);
    }
    expect(seen.size).toBe(CHEDDAR_PORTRAITS.length);
  });

  it("is deterministic for a given source", () => {
    expect(pickCelebration(scripted(0.5, 0.5))).toEqual(pickCelebration(scripted(0.5, 0.5)));
  });

  it("can reach every quip and every move", () => {
    const quips = new Set<string>();
    const moves = new Set<string>();
    // Sampling the midpoint of each slot, which is what a uniform source hits.
    for (let i = 0; i < CHEDDAR_QUIPS.length; i++) {
      quips.add(pickCelebration(scripted((i + 0.5) / CHEDDAR_QUIPS.length)).quip);
    }
    for (let i = 0; i < CHEDDAR_MOVES.length; i++) {
      moves.add(pickCelebration(scripted(0, (i + 0.5) / CHEDDAR_MOVES.length)).move);
    }
    expect(quips.size).toBe(CHEDDAR_QUIPS.length);
    expect(moves.size).toBe(CHEDDAR_MOVES.length);
  });

  it("never hands back a blank line, whatever it is given", () => {
    // A speech bubble with nothing in it is the worst possible outcome at the
    // one moment that is supposed to be fun, so out-of-contract values are
    // clamped rather than trusted.
    for (const value of [0, 0.999_999_999, 1, 1.5, -0.4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { quip, move, portrait } = pickCelebration(scripted(value));
      expect(CHEDDAR_QUIPS).toContain(quip);
      expect(CHEDDAR_MOVES).toContain(move);
      // A missing drawing would be an empty box where the mouse should be.
      expect(CHEDDAR_PORTRAITS).toContain(portrait);
    }
  });

  it("defaults to real randomness without an argument", () => {
    const { quip, move, portrait } = pickCelebration();
    expect(CHEDDAR_QUIPS).toContain(quip);
    expect(CHEDDAR_MOVES).toContain(move);
    expect(CHEDDAR_PORTRAITS).toContain(portrait);
  });
});

describe("timings", () => {
  it("fades quickly enough not to be sat through", () => {
    expect(CELEBRATION_FADE_MS).toBeGreaterThan(0);
    expect(CELEBRATION_FADE_MS).toBeLessThanOrEqual(600);
  });
});
