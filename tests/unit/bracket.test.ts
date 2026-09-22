import { describe, expect, it } from "vitest";
import {
  FINAL_ROUND,
  bracketOrder,
  changedMatches,
  compareScores,
  journeyOf,
  matchesInRound,
  nextSlot,
  ordinal,
  parseScore,
  resolveBracket,
  seedFirstRound,
  standings,
  type MatchInput,
  type ResolvedMatch,
} from "@/lib/bracket";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 14, 8, minute));
const team = (n: number) => ({ id: `t${n}`, name: `Team ${String(n).padStart(2, "0")}` });

/** An empty bracket with the round of 32 drawn from `count` qualifiers. */
function drawn(count: number): MatchInput[] {
  const bySeed = Array.from({ length: count }, (_, i) => `t${i + 1}`);
  const first = seedFirstRound(bySeed).map((m) => ({
    id: `m${m.round}-${m.slot}`,
    ...m,
    scoreA: null,
    scoreB: null,
    winnerId: null,
  }));
  const later: MatchInput[] = [];
  for (let round = 3; round <= FINAL_ROUND; round++) {
    for (let slot = 0; slot < matchesInRound(round); slot++) {
      later.push({
        id: `m${round}-${slot}`,
        round,
        slot,
        teamAId: null,
        teamBId: null,
        seedA: null,
        seedB: null,
        scoreA: null,
        scoreB: null,
        winnerId: null,
      });
    }
  }
  return [...first, ...later];
}

/** Plays every playable match, the better seed winning, until done. */
function playOut(matches: MatchInput[]): ResolvedMatch[] {
  let current: MatchInput[] = matches;
  for (let pass = 0; pass < 6; pass++) {
    const { matches: resolved } = resolveBracket(current, "HIGHER");
    current = resolved.map((m) =>
      m.teamAId && m.teamBId && m.winnerId === null
        ? { ...m, scoreA: 100 - (m.seedA ?? 0), scoreB: 100 - (m.seedB ?? 0) }
        : m,
    );
  }
  return resolveBracket(current, "HIGHER").matches;
}

const find = (matches: ResolvedMatch[], round: number, slot: number) =>
  matches.find((m) => m.round === round && m.slot === slot)!;

describe("scores", () => {
  it("compares either way round", () => {
    expect(compareScores(10, 5, "HIGHER")).toBeLessThan(0);
    expect(compareScores(10, 5, "LOWER")).toBeGreaterThan(0);
    expect(compareScores(7, 7, "LOWER")).toBe(0);
  });

  it("reads a score from a form, accepting a comma decimal", () => {
    expect(parseScore("12,5")).toBe(12.5);
    expect(parseScore("  ")).toBeNull();
    expect(parseScore("fast")).toBeNull();
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 32].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "32nd",
    ]);
  });
});

describe("qualifying standings", () => {
  const teams = [team(1), team(2), team(3), team(4)];

  it("counts each team's best run", () => {
    const table = standings(
      teams,
      [
        { registrationId: "t1", score: 40, createdAt: at(1) },
        { registrationId: "t1", score: 90, createdAt: at(5) },
        { registrationId: "t2", score: 70, createdAt: at(2) },
      ],
      "HIGHER",
    );
    expect(table.map((row) => [row.teamId, row.best, row.rank, row.runs])).toEqual([
      ["t1", 90, 1, 2],
      ["t2", 70, 2, 1],
      ["t3", null, null, 0],
      ["t4", null, null, 0],
    ]);
  });

  it("ranks the other way when lower is better", () => {
    const table = standings(
      teams,
      [
        { registrationId: "t1", score: 40, createdAt: at(1) },
        { registrationId: "t2", score: 25, createdAt: at(2) },
      ],
      "LOWER",
    );
    expect(table[0]!.teamId).toBe("t2");
  });

  it("breaks a tie by who set the score first", () => {
    const table = standings(
      teams,
      [
        { registrationId: "t3", score: 50, createdAt: at(9) },
        { registrationId: "t4", score: 50, createdAt: at(3) },
      ],
      "HIGHER",
    );
    expect(table.slice(0, 2).map((row) => row.teamId)).toEqual(["t4", "t3"]);
  });

  it("qualifies only down to the cutoff", () => {
    const runs = teams.map((t, i) => ({ registrationId: t.id, score: 100 - i, createdAt: at(i) }));
    const table = standings(teams, runs, "HIGHER", { cutoff: 2 });
    expect(table.map((row) => row.qualified)).toEqual([true, true, false, false]);
  });

  it("leaves an ineligible team unranked so the next team moves up", () => {
    const runs = teams.map((t, i) => ({ registrationId: t.id, score: 100 - i, createdAt: at(i) }));
    const table = standings(teams, runs, "HIGHER", { cutoff: 2, ineligible: new Set(["t1"]) });
    expect(table.filter((row) => row.qualified).map((row) => row.teamId)).toEqual(["t2", "t3"]);
    expect(table.find((row) => row.teamId === "t1")!.rank).toBeNull();
  });
});

describe("the draw", () => {
  it("lays 32 seeds out in bracket order", () => {
    expect(bracketOrder(32)).toEqual([
      1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19,
      6, 27, 11, 22,
    ]);
  });

  it("pairs 1st with 32nd, 2nd with 31st and so on, every seed exactly once", () => {
    const matches = seedFirstRound(Array.from({ length: 32 }, (_, i) => `t${i + 1}`));
    expect(matches).toHaveLength(16);
    for (const match of matches) expect(match.seedA + match.seedB).toBe(33);
    const seeds = matches.flatMap((m) => [m.seedA, m.seedB]).sort((a, b) => a - b);
    expect(seeds).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(matches.find((m) => m.seedA === 1)!.teamBId).toBe("t32");
    expect(matches.find((m) => m.seedA === 2)!.teamBId).toBe("t31");
  });

  it("sends each winner to the right place in the next round", () => {
    expect(nextSlot(2, 0)).toEqual({ round: 3, slot: 0, side: "A" });
    expect(nextSlot(2, 1)).toEqual({ round: 3, slot: 0, side: "B" });
    expect(nextSlot(5, 1)).toEqual({ round: 6, slot: 0, side: "B" });
    expect(nextSlot(6, 0)).toBeNull();
  });

  it("keeps the top seeds apart: with favourites winning, 1 meets 2 in the final", () => {
    const done = playOut(drawn(32));
    const final = find(done, 6, 0);
    expect([final.seedA, final.seedB].sort()).toEqual([1, 2]);
    expect(final.winnerId).toBe("t1");
    const semis = [find(done, 5, 0), find(done, 5, 1)].map((m) => [m.seedA!, m.seedB!].sort((a, b) => a - b));
    expect(semis).toEqual([
      [1, 4],
      [2, 3],
    ]);
    const quarters = [0, 1, 2, 3].map((slot) => find(done, 4, slot)).map((m) => (m.seedA ?? 0) + (m.seedB ?? 0));
    expect(quarters).toEqual([9, 9, 9, 9]);
  });

  it("gives byes to the top seeds when fewer than 32 qualify", () => {
    const { matches } = resolveBracket(drawn(28), "HIGHER");
    const walkovers = matches.filter((m) => m.round === 2 && m.walkover);
    expect(walkovers.map((m) => m.winnerId).sort()).toEqual(["t1", "t2", "t3", "t4"]);
    // And they are waiting in the round of 16 already.
    expect(find(matches, 3, 0).teamAId).toBe("t1");
  });

  it("copes with a tiny field, where two byes can meet", () => {
    const done = playOut(drawn(5));
    expect(done.some((m) => m.void)).toBe(true);
    expect(find(done, 6, 0).winnerId).toBe("t1");
  });
});

describe("results", () => {
  it("decides a match by score, and sends the winner on", () => {
    const matches = drawn(32);
    const first = matches.find((m) => m.round === 2 && m.slot === 0)!;
    first.scoreA = 10;
    first.scoreB = 12;
    const { matches: resolved } = resolveBracket(matches, "HIGHER");
    expect(find(resolved, 2, 0).winnerId).toBe("t32");
    expect(find(resolved, 3, 0).teamAId).toBe("t32");
    expect(find(resolved, 3, 0).seedA).toBe(32);
  });

  it("uses the lower score when lower is better", () => {
    const matches = drawn(32);
    const first = matches.find((m) => m.round === 2 && m.slot === 0)!;
    first.scoreA = 10;
    first.scoreB = 12;
    expect(find(resolveBracket(matches, "LOWER").matches, 2, 0).winnerId).toBe("t1");
  });

  it("marks a level score as tied and waits for the scorer to pick", () => {
    const matches = drawn(32);
    const first = matches.find((m) => m.round === 2 && m.slot === 0)!;
    first.scoreA = 10;
    first.scoreB = 10;
    let resolved = find(resolveBracket(matches, "HIGHER").matches, 2, 0);
    expect(resolved.tied).toBe(true);
    expect(resolved.winnerId).toBeNull();
    first.winnerId = "t32";
    resolved = find(resolveBracket(matches, "HIGHER").matches, 2, 0);
    expect(resolved.winnerId).toBe("t32");
  });

  it("accepts a walkover: a winner with no scores", () => {
    const matches = drawn(32);
    matches.find((m) => m.round === 2 && m.slot === 0)!.winnerId = "t1";
    expect(find(resolveBracket(matches, "HIGHER").matches, 3, 0).teamAId).toBe("t1");
  });

  it("ignores a stored winner who is not in the match", () => {
    const matches = drawn(32);
    matches.find((m) => m.round === 2 && m.slot === 0)!.winnerId = "t7";
    expect(find(resolveBracket(matches, "HIGHER").matches, 2, 0).winnerId).toBeNull();
  });

  it("reports, and clears, later results an edit would invalidate", () => {
    const done = playOut(drawn(32));
    // Seed 32 now beats seed 1 in the first round, after the fact.
    const edited: MatchInput[] = done.map((m) =>
      m.round === 2 && m.slot === 0 ? { ...m, scoreA: 1, scoreB: 99 } : m,
    );
    const { matches, conflicts } = resolveBracket(edited, "HIGHER");
    expect(conflicts.map((m) => `${m.round}:${m.slot}`)).toEqual(["3:0", "4:0", "5:0", "6:0"]);
    expect(find(matches, 3, 0).teamAId).toBe("t32");
    expect(find(matches, 3, 0).scoreA).toBeNull();
    expect(find(matches, 6, 0).winnerId).toBeNull();
  });

  it("does not call a redrawn bye a conflict", () => {
    const resolved = resolveBracket(drawn(28), "HIGHER").matches;
    // Re-seeding a different field over it moves who gets the byes.
    const redrawn = drawn(30).map((m) => {
      const old = resolved.find((r) => r.round === m.round && r.slot === m.slot)!;
      return m.round === 2 ? m : { ...m, teamAId: old.teamAId, teamBId: old.teamBId, winnerId: old.winnerId };
    });
    expect(resolveBracket(redrawn, "HIGHER").conflicts).toEqual([]);
  });

  it("lists only the matches that actually changed", () => {
    const first = resolveBracket(drawn(32), "HIGHER").matches;
    expect(changedMatches(first, resolveBracket(first, "HIGHER").matches)).toEqual([]);
  });
});

describe("a team's journey", () => {
  const table = standings([team(1)], [{ registrationId: "t1", score: 5, createdAt: at(0) }], "HIGHER");

  it("is provisional while qualifying is open", () => {
    expect(journeyOf("t1", table[0], [], false).label).toBe("Provisionally 1st");
    expect(journeyOf("t9", undefined, [], false).state).toBe("REGISTERED");
  });

  it("says a team did not qualify once the bracket is drawn without it", () => {
    expect(journeyOf("t99", undefined, resolveBracket(drawn(32), "HIGHER").matches, true).state).toBe(
      "NOT_QUALIFIED",
    );
  });

  it("follows a team to the title, and its opponent to second", () => {
    const done = playOut(drawn(32));
    expect(journeyOf("t1", undefined, done, true)).toMatchObject({ state: "CHAMPION", seed: 1 });
    expect(journeyOf("t2", undefined, done, true).state).toBe("RUNNER_UP");
    expect(journeyOf("t32", undefined, done, true)).toMatchObject({
      state: "ELIMINATED",
      label: "Out in the Round of 32",
    });
    expect(journeyOf("t5", undefined, done, true).label).toBe("Out in the Quarter-finals");
  });

  it("shows a team through to the next round before it is played", () => {
    const matches = drawn(32);
    matches.find((m) => m.round === 2 && m.slot === 0)!.winnerId = "t1";
    const resolved = resolveBracket(matches, "HIGHER").matches;
    expect(journeyOf("t1", undefined, resolved, true).label).toBe("In the Round of 16");
  });
});
