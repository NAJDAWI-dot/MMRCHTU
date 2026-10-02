import { describe, expect, it } from "vitest";
import { awardsList, highestScore, picksOf, placings, type AwardMatch } from "@/lib/awards";
import {
  FINAL_ROUND,
  THIRD_PLACE_ROUND,
  journeyOf,
  matchesInRound,
  phaseInfo,
  resolveBracket,
  revealPhaseOf,
  seedFirstRound,
  type MatchInput,
  type ResolvedMatch,
} from "@/lib/bracket";
import type { CompetitionState } from "@/lib/competition";
import { cleanMaze, parseMazeNames, serializeMazeNames, shareOut, sideMaze } from "@/lib/mazes";
import { NOTHING_HIDDEN, recentReveal, redactBracket } from "@/lib/reveal";
import { revealShow } from "@/lib/reveal-show";
import { finalPlacings } from "@/lib/screen-boards";

/** A bracket of 16, drawn, with or without the third place play-off row. */
function drawn16(withPlayoff = true): MatchInput[] {
  const bySeed = Array.from({ length: 16 }, (_, i) => `t${i + 1}`);
  const rows: MatchInput[] = seedFirstRound(bySeed, 16).map((m) => ({ id: `m${m.round}-${m.slot}`, ...m, scoreA: null, scoreB: null, winnerId: null }));
  const rounds = withPlayoff ? [4, 5, 6, THIRD_PLACE_ROUND] : [4, 5, 6];
  for (const round of rounds) {
    for (let slot = 0; slot < matchesInRound(round); slot++) {
      rows.push({ id: `m${round}-${slot}`, round, slot, teamAId: null, teamBId: null, seedA: null, seedB: null, scoreA: null, scoreB: null, winnerId: null });
    }
  }
  return rows;
}

/** Plays every playable match, the better seed winning (higher score), until nothing changes. */
function playOut(input: MatchInput[], until = THIRD_PLACE_ROUND): ResolvedMatch[] {
  let current: MatchInput[] = input;
  for (let pass = 0; pass < 8; pass++) {
    current = resolveBracket(current, "HIGHER").matches.map((m) =>
      m.teamAId && m.teamBId && m.winnerId === null && m.round <= until
        ? { ...m, scoreA: 200 - (m.seedA ?? 0) * 10, scoreB: 200 - (m.seedB ?? 0) * 10 }
        : m,
    );
  }
  return resolveBracket(current, "HIGHER").matches;
}

const at = (matches: ResolvedMatch[], round: number, slot = 0) => matches.find((m) => m.round === round && m.slot === slot)!;

describe("the third place play-off", () => {
  it("is played by whoever lost each semi-final", () => {
    const matches = playOut(drawn16(), 5);
    const playoff = at(matches, THIRD_PLACE_ROUND);
    expect([playoff.teamAId, playoff.teamBId]).toEqual(["t4", "t3"]);
    expect([playoff.seedA, playoff.seedB]).toEqual([4, 3]);
    expect(playoff.winnerId).toBeNull();
  });

  it("waits for both semi-finals", () => {
    const matches = playOut(drawn16(), 4);
    const playoff = at(matches, THIRD_PLACE_ROUND);
    expect([playoff.teamAId, playoff.teamBId]).toEqual([null, null]);
  });

  it("is left out of a bracket drawn without it", () => {
    expect(playOut(drawn16(false)).some((m) => m.round === THIRD_PLACE_ROUND)).toBe(false);
  });

  it("gives its winner third place and its loser fourth", () => {
    const matches = playOut(drawn16());
    expect(at(matches, THIRD_PLACE_ROUND).winnerId).toBe("t3");
    expect(journeyOf("t3", undefined, matches, true)).toMatchObject({ state: "THIRD", label: "Third place" });
    expect(journeyOf("t4", undefined, matches, true)).toMatchObject({ state: "FOURTH", label: "Fourth place" });
    expect(journeyOf("t1", undefined, matches, true).state).toBe("CHAMPION");
    expect(journeyOf("t2", undefined, matches, true).state).toBe("RUNNER_UP");
  });

  it("puts a beaten semi-finalist in the play-off until it is played", () => {
    const matches = playOut(drawn16(), 5);
    expect(journeyOf("t4", undefined, matches, true)).toMatchObject({ state: "ALIVE", label: "In the third place play-off" });
  });

  it("has a name, one match, and belongs with the final for what the public sees", () => {
    expect(phaseInfo(THIRD_PLACE_ROUND).name).toBe("Third place play-off");
    expect(matchesInRound(THIRD_PLACE_ROUND)).toBe(1);
    expect(revealPhaseOf(THIRD_PLACE_ROUND)).toBe(FINAL_ROUND);
    expect(revealPhaseOf(5)).toBe(5);
  });
});

const board = (round: number, a: string | null, b: string | null, extra: Partial<AwardMatch> = {}): AwardMatch => ({
  round,
  slot: 0,
  teamAId: a,
  teamBId: b,
  scoreA: null,
  scoreB: null,
  winnerId: null,
  walkover: false,
  void: false,
  ...extra,
});

describe("the awards", () => {
  it("reads the podium off the final and the play-off", () => {
    const matches = [
      board(6, "a", "b", { winnerId: "b" }),
      board(THIRD_PLACE_ROUND, "c", "d", { winnerId: "c" }),
    ];
    expect(placings(matches)).toEqual({ first: "b", second: "a", third: "c", fourth: "d" });
    expect(placings([board(6, "a", "b")])).toEqual({ first: null, second: null, third: null, fourth: null });
  });

  it("finds the highest single knockout score, the earlier one on a tie, skipping byes", () => {
    const matches = [
      board(3, "a", "b", { scoreA: 140, scoreB: 90, winnerId: "a" }),
      board(5, "c", "a", { scoreA: 140, scoreB: 100, winnerId: "c" }),
      board(2, "x", null, { scoreA: 999, walkover: true, winnerId: "x" }),
    ];
    expect(highestScore(matches)).toEqual({ teamId: "a", score: 140, round: 3 });
    expect(highestScore([board(THIRD_PLACE_ROUND, "c", "d", { scoreA: 150, scoreB: 10, winnerId: "c" }), ...matches])).toEqual({
      teamId: "c",
      score: 150,
      round: THIRD_PLACE_ROUND,
    });
    expect(highestScore([])).toBeNull();
  });

  it("lists every award in the rulebook's order, holding the score and the judges' picks back until shown", () => {
    const matches = [board(6, "a", "b", { scoreA: 120, scoreB: 80, winnerId: "a" })];
    const picks = { awardBestCode: "c", awardBestCodeRunnerUp: "", awardBestDesign: "d", awardBestDesignRunnerUp: "e" };
    const shown = awardsList(matches, picks, true);
    expect(shown.map((award) => award.title)).toEqual([
      "MMRC26 Champion",
      "2nd place",
      "3rd place",
      "Overall Highest Score",
      "Best Code",
      "Best Code runner-up",
      "Best Creative Design",
      "Best Creative Design runner-up",
    ]);
    expect(shown.map((award) => award.teamId)).toEqual(["a", "b", null, "a", "c", null, "d", "e"]);
    expect(shown[3]!.detail).toBe("120.0 points in the Final");

    const held = awardsList(matches, picks, false);
    expect(held.map((award) => award.teamId)).toEqual(["a", "b", null, null, null, null, null, null]);
    expect(held[3]!.detail).toBe("");
  });

  it("drops a pick for a team that is no longer in the competition", () => {
    const picks = picksOf({ awardBestCode: "a", awardBestCodeRunnerUp: "gone", awardBestDesign: " b ", awardBestDesignRunnerUp: "" }, (id) => ["a", "b"].includes(id));
    expect(picks).toEqual({ awardBestCode: "a", awardBestCodeRunnerUp: "", awardBestDesign: "b", awardBestDesignRunnerUp: "" });
  });
});

describe("the final placings on the hall screen", () => {
  const semis = [
    { ...board(5, "a", "c", { winnerId: "a" }), status: "DONE" },
    { ...board(5, "b", "d", { winnerId: "b" }), status: "DONE" },
    { ...board(6, "a", "b", { winnerId: "b" }), status: "DONE" },
  ];

  it("shares third between the beaten semi-finalists until the play-off is decided", () => {
    expect(finalPlacings([...semis, { ...board(THIRD_PLACE_ROUND, "c", "d"), status: "PENDING" }]).map((p) => [p.place, p.teamId])).toEqual([
      [1, "b"],
      [2, "a"],
      [3, "c"],
      [3, "d"],
    ]);
  });

  it("puts the play-off's winner third and its loser fourth", () => {
    expect(finalPlacings([...semis, { ...board(THIRD_PLACE_ROUND, "c", "d", { winnerId: "d" }), status: "DONE" }]).map((p) => [p.place, p.teamId])).toEqual([
      [1, "b"],
      [2, "a"],
      [3, "d"],
      [4, "c"],
    ]);
  });
});

describe("holding the play-off back", () => {
  const matches = playOut(drawn16());

  it("hides its pairing with the final's, while who went through from the semi-finals is held back", () => {
    const redacted = redactBracket(matches, { hiddenResults: [], hiddenAdvance: [5] });
    expect(at(redacted, THIRD_PLACE_ROUND).teamAId).toBeNull();
    expect(at(redacted, FINAL_ROUND).teamAId).toBeNull();
  });

  it("hides its scores and winner with the final's", () => {
    const redacted = redactBracket(matches, { hiddenResults: [6], hiddenAdvance: [6] });
    const playoff = at(redacted, THIRD_PLACE_ROUND);
    expect(playoff.teamAId).toBe("t4");
    expect(playoff.scoreA).toBeNull();
    expect(playoff.winnerId).toBeNull();
  });

  it("shows everything when nothing is held back", () => {
    expect(at(redactBracket(matches, NOTHING_HIDDEN), THIRD_PLACE_ROUND).winnerId).toBe("t3");
  });
});

describe("revealing the awards", () => {
  it("is remembered as an awards reveal", () => {
    expect(recentReveal(`awards|awards|${1000}`, 2000)).toEqual({ phase: "awards", kind: "awards", at: 1000 });
    expect(recentReveal(`awards|results|${1000}`, 2000)).toBeNull();
  });

  it("plays the awards on the hall screen, the judges' first and the champions last", () => {
    const state = { competitors: [], byId: new Map([["a", { name: "Alpha" }], ["b", { name: "Beta" }], ["c", { name: "Gamma" }]]) } as unknown as CompetitionState;
    const awards = awardsList([board(6, "a", "b", { scoreA: 120, scoreB: 80, winnerId: "a" })], { awardBestCode: "c", awardBestCodeRunnerUp: "", awardBestDesign: "", awardBestDesignRunnerUp: "" }, true);
    const show = revealShow(state, { phase: "awards", kind: "awards", at: 5 }, awards);
    expect(show?.mode).toBe("awards");
    expect(show?.rows.map((row) => [row.value, row.name])).toEqual([
      ["Best Code", "Gamma"],
      ["Overall Highest Score", "Alpha"],
      ["2nd place", "Beta"],
      ["MMRC26 Champion", "Alpha"],
    ]);
  });
});

describe("the mazes", () => {
  it("reads the maze names once each, however they are separated", () => {
    expect(parseMazeNames("Maze A, Maze B\nmaze a,,  Left   table ")).toEqual(["Maze A", "Maze B", "Left table"]);
    expect(serializeMazeNames(["Maze A", "", "Maze B"])).toBe("Maze A,Maze B");
    expect(parseMazeNames("")).toEqual([]);
  });

  it("cleans a maze name to one short line", () => {
    expect(cleanMaze("  Maze\n A ")).toBe("Maze A");
    expect(cleanMaze("x".repeat(80))).toHaveLength(40);
    expect(cleanMaze(null)).toBe("");
  });

  it("shares the teams out across the mazes in turn", () => {
    expect([...shareOut(["a", "b", "c"], ["Maze A", "Maze B"])]).toEqual([
      ["a", "Maze A"],
      ["b", "Maze B"],
      ["c", "Maze A"],
    ]);
    expect(shareOut(["a"], []).size).toBe(0);
  });

  it("says which maze a team runs on in a match", () => {
    const match = { teamAId: "a", teamBId: "b", mazeA: "Maze A", mazeB: "Maze B" };
    expect(sideMaze(match, "a")).toBe("Maze A");
    expect(sideMaze(match, "b")).toBe("Maze B");
    expect(sideMaze(match, "c")).toBe("");
  });
});
