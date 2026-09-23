import { describe, expect, it } from "vitest";
import { finalPlacings, roundLeaderboard, type BoardMatch } from "@/lib/screen-boards";

const match = (round: number, a: string | null, b: string | null, extra: Partial<BoardMatch> = {}): BoardMatch => ({
  round,
  teamAId: a,
  teamBId: b,
  scoreA: null,
  scoreB: null,
  winnerId: null,
  status: "PENDING",
  walkover: false,
  void: false,
  ...extra,
});

describe("the round leaderboard", () => {
  it("ranks the round by match score, and says who went through", () => {
    const rows = roundLeaderboard(
      [
        match(3, "a", "b", { scoreA: 120, scoreB: 180, winnerId: "b" }),
        match(3, "c", "d", { scoreA: 95, scoreB: 60, winnerId: "c" }),
        match(3, "e", "f", { status: "LIVE" }),
        match(3, "g", "h"),
        match(2, "x", "y", { scoreA: 999, scoreB: 1, winnerId: "x" }),
      ],
      3,
    );
    expect(rows.map((row) => [row.teamId, row.result])).toEqual([
      ["b", "through"],
      ["a", "out"],
      ["c", "through"],
      ["d", "out"],
      ["e", "live"],
      ["f", "live"],
      ["g", "to-play"],
      ["h", "to-play"],
    ]);
    expect(rows[0]!.opponentId).toBe("a");
  });

  it("leaves out byes and empty slots", () => {
    const rows = roundLeaderboard([match(2, "a", null, { walkover: true, winnerId: "a" }), match(2, null, null, { void: true })], 2);
    expect(rows).toEqual([]);
  });
});

describe("the final placings", () => {
  it("is empty until the final is decided", () => {
    expect(finalPlacings([match(6, "a", "b")])).toEqual([]);
  });

  it("puts the champion first, the runner-up second and both beaten semi-finalists third", () => {
    const placings = finalPlacings([
      match(5, "a", "c", { winnerId: "a" }),
      match(5, "b", "d", { winnerId: "b" }),
      match(6, "a", "b", { winnerId: "b" }),
    ]);
    expect(placings).toEqual([
      { place: 1, teamId: "b" },
      { place: 2, teamId: "a" },
      { place: 3, teamId: "c" },
      { place: 3, teamId: "d" },
    ]);
  });
});
