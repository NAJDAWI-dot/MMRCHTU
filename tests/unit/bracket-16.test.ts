import { describe, expect, it } from "vitest";
import {
  firstRoundFor,
  firstRoundOf,
  journeyOf,
  parseBracketSize,
  resolveBracket,
  roundsFor,
  seedFirstRound,
  standings,
  type MatchInput,
} from "@/lib/bracket";
import { firstHiddenRound, type Reveal } from "@/lib/reveal";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

/** A drawn bracket of the given size, with every later round empty, as drawBracket writes it. */
function drawn(size: 16 | 32, teams = ids(size)): MatchInput[] {
  const first = seedFirstRound(teams.slice(0, size), size).map((match) => ({ id: "", ...match, scoreA: null, scoreB: null, winnerId: null }));
  const later: MatchInput[] = [];
  for (let round = firstRoundFor(size) + 1; round <= 6; round++) {
    for (let slot = 0; slot < 2 ** (6 - round); slot++) {
      later.push({ id: "", round, slot, teamAId: null, teamBId: null, seedA: null, seedB: null, scoreA: null, scoreB: null, winnerId: null });
    }
  }
  return [...first, ...later];
}

describe("the size of the knockout", () => {
  it("starts 32 at the round of 32 and 16 at the round of 16", () => {
    expect(firstRoundFor(32)).toBe(2);
    expect(firstRoundFor(16)).toBe(3);
    expect(roundsFor(32)).toEqual([2, 3, 4, 5, 6]);
    expect(roundsFor(16)).toEqual([3, 4, 5, 6]);
  });

  it("reads anything that is not 16 as 32", () => {
    expect(parseBracketSize("16")).toBe(16);
    expect(parseBracketSize(16)).toBe(16);
    expect(parseBracketSize("32")).toBe(32);
    expect(parseBracketSize("")).toBe(32);
    expect(parseBracketSize(null)).toBe(32);
  });

  it("knows where a stored bracket starts", () => {
    expect(firstRoundOf(drawn(32))).toBe(2);
    expect(firstRoundOf(drawn(16))).toBe(3);
    expect(firstRoundOf([])).toBe(2);
  });
});

describe("the top 16", () => {
  it("pairs 1st with 16th, 2nd with 15th and so on, in the round of 16", () => {
    const first = seedFirstRound(ids(16), 16);
    expect(first).toHaveLength(8);
    expect(first.every((match) => match.round === 3)).toBe(true);
    const pairs = first.map((match) => [match.seedA, match.seedB].sort((a, b) => a - b).join("v")).sort();
    expect(pairs).toEqual(["1v16", "2v15", "3v14", "4v13", "5v12", "6v11", "7v10", "8v9"].sort());
    for (const match of first) expect(match.seedA + match.seedB).toBe(17);
  });

  it("keeps 1st and 2nd apart until the final", () => {
    const first = seedFirstRound(ids(16), 16);
    const slotOf = (seed: number) => first.findIndex((match) => match.seedA === seed || match.seedB === seed);
    expect(slotOf(1) < 4).not.toBe(slotOf(2) < 4);
  });

  it("gives byes to the top seeds when fewer than 16 qualify", () => {
    const first = seedFirstRound(ids(14), 16);
    const byes = first.filter((match) => !match.teamAId || !match.teamBId);
    expect(byes).toHaveLength(2);
    expect(byes.map((match) => match.teamAId ?? match.teamBId).sort()).toEqual(["t1", "t2"]);
  });

  it("resolves from the round of 16 without a round of 32", () => {
    const input = drawn(16);
    const winnerOf = (round: number, slot: number) => {
      const match = input.find((m) => m.round === round && m.slot === slot)!;
      return match;
    };
    // Every round of 16 match goes to side A.
    for (let slot = 0; slot < 8; slot++) {
      const match = winnerOf(3, slot);
      match.scoreA = 100;
      match.scoreB = 50;
    }
    const { matches } = resolveBracket(input, "HIGHER");
    expect(matches.some((match) => match.round === 2)).toBe(false);
    const quarters = matches.filter((match) => match.round === 4);
    expect(quarters).toHaveLength(4);
    expect(quarters.every((match) => match.teamAId && match.teamBId)).toBe(true);
  });

  it("gives a team its seed and journey from the round of 16", () => {
    const { matches } = resolveBracket(drawn(16), "HIGHER");
    const journey = journeyOf("t1", undefined, matches, true);
    expect(journey.seed).toBe(1);
    expect(journey.label).toBe("In the Round of 16");
  });

  it("puts the line on the standings at 16", () => {
    const teams = ids(20).map((id) => ({ id, name: id }));
    const runs = teams.map((team, i) => ({ registrationId: team.id, score: 200 - i, runTimes: [], remaining: null, runLog: [], createdAt: new Date(0) }));
    const table = standings(teams, runs, { cutoff: 16 });
    expect(table.filter((row) => row.qualified)).toHaveLength(16);
  });
});

describe("holding back a round of 16 draw", () => {
  const reveal = (hiddenAdvance: number[]): Reveal => ({ hiddenResults: [], hiddenAdvance });

  it("hides the round of 16 when who went through qualifying is hidden", () => {
    expect(firstHiddenRound(reveal([1]), 3)).toBe(3);
  });

  it("does not hide it for a round of 32 that is not being played", () => {
    expect(firstHiddenRound(reveal([2]), 3)).toBe(7);
  });

  it("works as before for a round of 32", () => {
    expect(firstHiddenRound(reveal([1]))).toBe(2);
    expect(firstHiddenRound(reveal([2]))).toBe(3);
  });
});
