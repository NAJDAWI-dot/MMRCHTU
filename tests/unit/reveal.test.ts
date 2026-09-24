import { describe, expect, it } from "vitest";
import { FINAL_ROUND, journeyOf, matchesInRound, resolveBracket, seedFirstRound, standings, type MatchInput } from "@/lib/bracket";
import type { CompetitionState } from "@/lib/competition";
import { planMatchResult, type StoredMatch } from "@/lib/match-results";
import {
  firstHiddenRound,
  heldBackLines,
  parsePhaseList,
  redactBracket,
  redactCompetition,
  redactTable,
  serializePhaseList,
  type Reveal,
} from "@/lib/reveal";
import { scoreSheet } from "@/lib/score-sheet";

const at = (minute: number) => new Date(Date.UTC(2026, 2, 14, 8, minute));
const teams = Array.from({ length: 34 }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${String(i + 1).padStart(2, "0")}` }));
// t1 is best, t34 worst.
const runs = teams.map((team, i) => ({ registrationId: team.id, score: null, runTimes: [20 + i], createdAt: at(i) }));
const hide = (results: number[] = [], advance: number[] = []): Reveal => ({ hiddenResults: results, hiddenAdvance: advance });

/** The round of 32 drawn from t1..t32, the better seed winning every match through `rounds`. */
function played(rounds: number): MatchInput[] {
  let matches: MatchInput[] = [
    ...seedFirstRound(teams.slice(0, 32).map((t) => t.id)).map((m) => ({ id: `m${m.round}-${m.slot}`, ...m, scoreA: null, scoreB: null, winnerId: null })),
  ];
  for (let round = 3; round <= FINAL_ROUND; round++) {
    for (let slot = 0; slot < matchesInRound(round); slot++) {
      matches.push({ id: `m${round}-${slot}`, round, slot, teamAId: null, teamBId: null, seedA: null, seedB: null, scoreA: null, scoreB: null, winnerId: null });
    }
  }
  for (let pass = 0; pass < 6; pass++) {
    matches = resolveBracket(matches, "HIGHER").matches.map((m) =>
      m.teamAId && m.teamBId && m.round < 2 + rounds && m.winnerId === null ? { ...m, scoreA: 100 - (m.seedA ?? 0), scoreB: 100 - (m.seedB ?? 0) } : m,
    );
  }
  return matches;
}

describe("the phase lists", () => {
  it("reads and writes phases, dropping anything else", () => {
    expect(parsePhaseList("3, 1,x,9,1")).toEqual([1, 3]);
    expect(serializePhaseList([6, 2, 2])).toBe("2,6");
  });
});

describe("holding back qualifying", () => {
  const table = standings(teams, runs);

  it("hides scores, runs and places, and orders by name so the order says nothing", () => {
    const shown = redactTable(table, hide([1]));
    expect(shown.every((row) => row.best === null && row.rank === null && row.times.length === 0 && row.log.length === 0)).toBe(true);
    expect(shown.every((row) => row.recorded)).toBe(true);
    // Who qualified is still shown, and those come first, by name.
    expect(shown.slice(0, 32).every((row) => row.qualified)).toBe(true);
    expect(shown.slice(32).map((row) => row.teamId)).toEqual(["t33", "t34"]);
  });

  it("hides who qualified on its own, keeping the scores", () => {
    const shown = redactTable(table, hide([], [1]));
    expect(shown.every((row) => !row.qualified)).toBe(true);
    expect(shown[0]!.best).not.toBeNull();
  });

  it("changes nothing with nothing hidden", () => {
    expect(redactTable(table, hide())).toBe(table);
  });
});

describe("holding back the knockout", () => {
  const bracket = resolveBracket(played(2), "HIGHER").matches;

  it("hides a round's scores but not who won it", () => {
    const shown = redactBracket(bracket, hide([2]));
    const r32 = shown.filter((m) => m.round === 2);
    expect(r32.every((m) => m.scoreA === null && m.scoreB === null && m.runLogA.length === 0)).toBe(true);
    expect(r32.every((m) => m.winnerId !== null)).toBe(true);
  });

  it("hides who went through a round, and with it the next round's pairings and everything after", () => {
    expect(firstHiddenRound(hide([], [2]))).toBe(3);
    const shown = redactBracket(bracket, hide([], [2]));
    expect(shown.filter((m) => m.round === 2).every((m) => m.winnerId === null && m.teamAId !== null)).toBe(true);
    expect(shown.filter((m) => m.round >= 3).every((m) => m.teamAId === null && m.teamBId === null && m.winnerId === null)).toBe(true);
  });

  it("hides the whole bracket while who qualified is held back", () => {
    expect(firstHiddenRound(hide([], [1]))).toBe(2);
    expect(redactBracket(bracket, hide([], [1])).every((m) => m.teamAId === null && m.teamBId === null)).toBe(true);
  });
});

describe("the public competition", () => {
  const table = standings(teams, runs);
  const bracket = resolveBracket(played(5), "HIGHER").matches.map((m) => ({ ...m, status: m.winnerId ? "DONE" : "PENDING", arena: "", scheduledAt: null, updatedAt: null }));
  const competitors = teams.map((team) => {
    const standing = table.find((row) => row.teamId === team.id);
    return { id: team.id, name: team.name, standing, journey: journeyOf(team.id, standing, bracket, true) };
  });
  const state = {
    qualifyingStatus: "LOCKED",
    competitors,
    table,
    bracket,
    drawn: true,
    byId: new Map(competitors.map((team) => [team.id, team])),
  } as unknown as CompetitionState;

  it("has champions only once the final is revealed", () => {
    expect(state.byId.get("t1")!.journey.state).toBe("CHAMPION");
    const held = redactCompetition(state, hide([], [6]));
    expect(held.byId.get("t1")!.journey.state).toBe("ALIVE");
    expect(held.byId.get("t1")!.journey.label).toBe("In the Final");
  });

  it("says nobody qualified or did not while the draw is held back", () => {
    const held = redactCompetition(state, hide([], [1]));
    expect(held.drawn).toBe(false);
    expect(held.byId.get("t34")!.journey.state).toBe("QUALIFYING");
    expect(held.byId.get("t34")!.journey.label).toBe("Results to come");
    expect(held.byId.get("t1")!.journey.state).toBe("QUALIFYING");
  });

  it("carries what is held back, for the pages to say so", () => {
    expect(redactCompetition(state, hide([1])).reveal).toEqual(hide([1]));
    expect(heldBackLines(hide([1], [2]), [1, 2])).toEqual([
      "Qualifying scores are under wraps until they are announced.",
      "Who goes through from the Round of 32 is announced soon.",
    ]);
    expect(heldBackLines(hide([2, 3]), [2, 3])).toEqual(["All scores are under wraps until they are announced."]);
    expect(heldBackLines(hide(), [1, 2])).toEqual([]);
  });
});

describe("the judges' say", () => {
  it("puts a team through, or keeps it out, whatever its place", () => {
    const table = standings(teams, runs, { overrides: new Map([["t34", "IN" as const], ["t2", "OUT" as const]]) });
    const through = table.filter((row) => row.qualified).map((row) => row.teamId);
    expect(through).toHaveLength(32);
    expect(through).toContain("t34");
    expect(through).not.toContain("t2");
    // The two places taken by t34 and freed by t2 come off the bottom of the cut: t33 misses out, t32 is in.
    expect(through).not.toContain("t33");
    expect(through).toContain("t32");
    expect(table.find((row) => row.teamId === "t34")!.override).toBe("IN");
  });

  it("lets the judges' winner stand over the sheets, and survive a later edit", () => {
    const rows = played(0).map((m) => ({ ...m, id: m.id ?? "", status: "PENDING" })) as StoredMatch[];
    const target = rows.find((m) => m.round === 2 && m.slot === 0)!;
    const sheet = (time: number) => scoreSheet({ times: [time], remaining: null });
    const plan = planMatchResult(rows, target, sheet(20), sheet(40), target.teamBId, true);
    expect(plan.ok && plan.target.winnerId).toBe(target.teamBId);
    expect(plan.ok && plan.target.winnerOverride).toBe(true);
    if (!plan.ok) return;
    // Resolved again from what was stored, the decision stands.
    const again = resolveBracket(plan.matches, "HIGHER").matches.find((m) => m.round === 2 && m.slot === 0)!;
    expect(again.winnerId).toBe(target.teamBId);
    // Without the override, the sheets decide.
    const plain = planMatchResult(rows, target, sheet(20), sheet(40), null);
    expect(plain.ok && plain.target.winnerId).toBe(target.teamAId);
  });
});

describe("the reveal moment", () => {
  it("reads the last reveal, only while it is recent", async () => {
    const { recentReveal } = await import("@/lib/reveal");
    const at = 1_000_000_000_000;
    expect(recentReveal(`1|results|${at}`, at + 60_000)).toEqual({ phase: 1, kind: "results", at });
    expect(recentReveal(`all|all|${at}`, at)).toEqual({ phase: "all", kind: "all", at });
    expect(recentReveal(`1|results|${at}`, at + 11 * 60_000)).toBeNull();
    expect(recentReveal("", at)).toBeNull();
    expect(recentReveal(`9|results|${at}`, at)).toBeNull();
    expect(recentReveal(`2|sideways|${at}`, at)).toBeNull();
  });

  it("builds the show from what is now public", async () => {
    const { revealShow } = await import("@/lib/reveal-show");
    const table = standings(teams, runs);
    const bracket = resolveBracket(played(5), "HIGHER").matches.map((m) => ({ ...m, status: m.winnerId ? "DONE" : "PENDING", arena: "", scheduledAt: null, updatedAt: null }));
    const competitors = teams.map((team) => {
      const standing = table.find((row) => row.teamId === team.id);
      return { id: team.id, name: team.name, standing, journey: journeyOf(team.id, standing, bracket, true) };
    });
    const state = { competitors, table, bracket, drawn: true, byId: new Map(competitors.map((t) => [t.id, t])) } as unknown as CompetitionState;

    const ranking = revealShow(state, { phase: 1, kind: "results", at: 1 })!;
    expect(ranking.mode).toBe("ranking");
    expect(ranking.rows).toHaveLength(10);
    expect(ranking.rows[0]!.name).toBe("Team 01");

    const through = revealShow(state, { phase: 1, kind: "advance", at: 1 })!;
    expect(through.mode).toBe("names");
    expect(through.rows).toHaveLength(32);
    expect(through.rows[0]!.value).toBe("Seed 1");

    const r32 = revealShow(state, { phase: 2, kind: "advance", at: 1 })!;
    expect(r32.title).toBe("Through to the Round of 16");
    expect(r32.rows).toHaveLength(16);

    const champions = revealShow(state, { phase: 6, kind: "advance", at: 1 })!;
    expect(champions.mode).toBe("champion");
    expect(champions.champion!.name).toBe("Team 01");
    expect(champions.champion!.detail).toBe("Beat Team 02 in the final");

    // Once hidden again, there is nothing to show.
    expect(revealShow(redactCompetition(state, hide([1])), { phase: 1, kind: "results", at: 1 })).toBeNull();
  });
});
