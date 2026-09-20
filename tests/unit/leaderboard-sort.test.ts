import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_SORTS,
  LEADERBOARD_SORT_LABELS,
  OPEN_DAY_EVENT,
  isLeaderboardSort,
  isScoreEvent,
  parseLeaderboardSort,
  parseScoreEvent,
} from "@/lib/leaderboard";

/**
 * The board can be ranked two ways, and the value arrives in a query string —
 * so the only thing that really matters is that anything unexpected lands on
 * the default rather than reaching Prisma as an order-by nobody wrote.
 */
describe("leaderboard sort", () => {
  it("knows only the two orderings", () => {
    expect([...LEADERBOARD_SORTS]).toEqual(["score", "sector"]);
    for (const sort of LEADERBOARD_SORTS) expect(isLeaderboardSort(sort)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLeaderboardSort("level")).toBe(false);
    expect(isLeaderboardSort("")).toBe(false);
    expect(isLeaderboardSort(null)).toBe(false);
    expect(isLeaderboardSort(2)).toBe(false);
  });

  it("falls back to score for a hand-edited query string", () => {
    expect(parseLeaderboardSort("sector")).toBe("sector");
    expect(parseLeaderboardSort("score")).toBe("score");
    expect(parseLeaderboardSort("createdAt")).toBe("score");
    expect(parseLeaderboardSort(undefined)).toBe("score");
  });

  it("names both for the toggle", () => {
    for (const sort of LEADERBOARD_SORTS) {
      expect(LEADERBOARD_SORT_LABELS[sort].length).toBeGreaterThan(0);
    }
  });
});

describe("parseScoreEvent", () => {
  it("accepts the boards the site actually has", () => {
    expect(parseScoreEvent("")).toBe("");
    expect(parseScoreEvent(OPEN_DAY_EVENT)).toBe("open-day");
  });

  it("falls back to the public board for anything else", () => {
    // The value arrives from a query string and from a request body, so this
    // is what stops an invented board from collecting scores of its own, and
    // what makes a mistyped link show the real leaderboard rather than an
    // empty one that reads as broken.
    expect(parseScoreEvent("open_day")).toBe("");
    expect(parseScoreEvent("OPEN-DAY")).toBe("");
    expect(parseScoreEvent("../../etc")).toBe("");
    expect(parseScoreEvent(null)).toBe("");
    expect(parseScoreEvent(7)).toBe("");
    expect(parseScoreEvent(undefined)).toBe("");
  });

  it("knows an event when it sees one", () => {
    expect(isScoreEvent("open-day")).toBe(true);
    expect(isScoreEvent("nope")).toBe(false);
  });
});
