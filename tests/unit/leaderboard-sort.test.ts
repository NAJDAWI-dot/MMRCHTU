import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_SORTS,
  LEADERBOARD_SORT_LABELS,
  isLeaderboardSort,
  parseLeaderboardSort,
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
