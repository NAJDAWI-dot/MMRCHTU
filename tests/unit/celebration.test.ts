import { describe, expect, it } from "vitest";
import {
  CHEDDAR_MOVES,
  CHEDDAR_QUIPS,
  CELEBRATION_AUTO_MS,
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

describe("pickCelebration", () => {
  it("picks the quip and the move independently", () => {
    // First call feeds the quip, second the move. Reading the same value twice
    // would lock move N to quip N and quietly collapse the variety.
    const { quip, move } = pickCelebration(scripted(0, 0.99));
    expect(quip).toBe(CHEDDAR_QUIPS[0]);
    expect(move).toBe(CHEDDAR_MOVES[CHEDDAR_MOVES.length - 1]);
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
      const { quip, move } = pickCelebration(scripted(value));
      expect(CHEDDAR_QUIPS).toContain(quip);
      expect(CHEDDAR_MOVES).toContain(move);
    }
  });

  it("defaults to real randomness without an argument", () => {
    const { quip, move } = pickCelebration();
    expect(CHEDDAR_QUIPS).toContain(quip);
    expect(CHEDDAR_MOVES).toContain(move);
  });
});

describe("timings", () => {
  it("clears itself long before anyone could think it is stuck", () => {
    expect(CELEBRATION_AUTO_MS).toBeGreaterThan(3000);
    expect(CELEBRATION_AUTO_MS).toBeLessThanOrEqual(15_000);
  });

  it("fades faster than it stays", () => {
    expect(CELEBRATION_FADE_MS).toBeLessThan(CELEBRATION_AUTO_MS);
  });
});
