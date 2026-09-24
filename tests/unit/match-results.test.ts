import { describe, expect, it } from "vitest";
import { FINAL_ROUND, changedMatches, matchesInRound, resolveBracket, seedFirstRound, standings } from "@/lib/bracket";
import { planMatchResult, qualifyingSlot, type StoredMatch } from "@/lib/match-results";
import { scoreSheet, type RunEntry } from "@/lib/score-sheet";

const ok = (time: number): RunEntry => ({ ok: true, time, cell: null });
const fail = (cell: number | null): RunEntry => ({ ok: false, time: null, cell });
const sheet = (...log: RunEntry[]) => scoreSheet({ times: [], remaining: null, log });

/** The round of 32 drawn from 32 teams, t1 to t32 by seed, nothing played. */
function drawn(): StoredMatch[] {
  const first = seedFirstRound(Array.from({ length: 32 }, (_, i) => `t${i + 1}`)).map((m) => ({
    ...m,
    id: `m${m.round}-${m.slot}`,
    status: "PENDING",
    scoreA: null,
    scoreB: null,
    winnerId: null,
  }));
  const later: StoredMatch[] = [];
  for (let round = 3; round <= FINAL_ROUND; round++) {
    for (let slot = 0; slot < matchesInRound(round); slot++) {
      later.push({ id: `m${round}-${slot}`, status: "PENDING", round, slot, teamAId: null, teamBId: null, seedA: null, seedB: null, scoreA: null, scoreB: null, winnerId: null });
    }
  }
  return [...first, ...later];
}

/** Applies a plan the way the desk writes it back. */
function apply(rows: StoredMatch[], plan: Extract<ReturnType<typeof planMatchResult>, { ok: true }>): StoredMatch[] {
  return plan.matches.map((match) => ({ ...match, id: rows.find((r) => r.round === match.round && r.slot === match.slot)!.id, status: "PENDING" }));
}

describe("a knockout result from two sheets", () => {
  it("puts a team with some failed runs through over one that never reached the centre", () => {
    const rows = drawn();
    const target = rows.find((m) => m.round === 2 && m.slot === 0)!;
    const plan = planMatchResult(rows, target, sheet(fail(50), ok(30)), sheet(fail(99), fail(97)), null);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.target.winnerId).toBe(target.teamAId);
    expect(plan.target.runLogA).toEqual([fail(50), ok(30)]);
    expect(plan.target.runLogB).toEqual([fail(99), fail(97)]);
    expect(plan.target.remainingB).toBe(1);
    // The winner is waiting in the round of 16.
    expect(plan.matches.find((m) => m.round === 3 && m.slot === 0)!.teamAId).toBe(target.teamAId);
  });

  it("puts the closer of two mice that never reached the centre through", () => {
    const rows = drawn();
    const target = rows.find((m) => m.round === 2 && m.slot === 1)!;
    const plan = planMatchResult(rows, target, sheet(fail(60)), sheet(fail(40), fail(75)), null);
    expect(plan.ok && plan.target.winnerId).toBe(target.teamBId);
  });

  it("asks for a pick when the sheets are level on everything", () => {
    const rows = drawn();
    const target = rows[0]!;
    const level = planMatchResult(rows, target, sheet(fail(null)), sheet(fail(null)), null);
    expect(level).toEqual({ ok: false, message: "The two sheets are level on everything the rulebook compares. Pick the winner." });
    const picked = planMatchResult(rows, target, sheet(fail(null)), sheet(fail(null)), target.teamBId);
    expect(picked.ok && picked.target.winnerId).toBe(target.teamBId);
  });

  it("sees a failed run added to a sheet as a change, although the score is the same", () => {
    let rows = drawn();
    const target = rows[0]!;
    const first = planMatchResult(rows, target, sheet(ok(30)), sheet(ok(40)), null);
    if (!first.ok) throw new Error(first.message);
    rows = apply(rows, first);
    const again = planMatchResult(rows, rows[0]!, sheet(ok(30), fail(98)), sheet(ok(40)), null);
    expect(again.ok && again.changed.map((m) => `${m.round}:${m.slot}`)).toEqual(["2:0"]);
  });

  it("reports later results that a changed winner throws away, runs and all", () => {
    let rows = drawn();
    for (const slot of [0, 1]) {
      const plan = planMatchResult(rows, rows.find((m) => m.round === 2 && m.slot === slot)!, sheet(ok(20)), sheet(ok(40)), null);
      if (!plan.ok) throw new Error(plan.message);
      rows = apply(rows, plan);
    }
    const r16 = rows.find((m) => m.round === 3 && m.slot === 0)!;
    const played = planMatchResult(rows, r16, sheet(ok(25), fail(99)), sheet(fail(97)), null);
    if (!played.ok) throw new Error(played.message);
    rows = apply(rows, played);

    // Now seed 32 wins the first match after all.
    const flip = planMatchResult(rows, rows.find((m) => m.round === 2 && m.slot === 0)!, sheet(ok(40)), sheet(ok(20)), null);
    expect(flip.ok).toBe(true);
    if (!flip.ok) return;
    expect(flip.later.map((m) => `${m.round}:${m.slot}`)).toEqual(["3:0"]);
    const cleared = flip.matches.find((m) => m.round === 3 && m.slot === 0)!;
    expect(cleared.runLogA).toEqual([]);
    expect(cleared.runLogB).toEqual([]);
    // The quarter-final loses the team the cleared match had sent on.
    expect(changedMatches(rows, flip.matches).map((m) => `${m.round}:${m.slot}`)).toEqual(["2:0", "3:0", "4:0"]);
  });

  it("clears the runs of a match that becomes a bye", () => {
    const rows = drawn().map((m) => (m.round === 2 && m.slot === 0 ? { ...m, teamBId: null, runLogA: [ok(20)] } : m));
    const match = resolveBracket(rows, "HIGHER").matches.find((m) => m.round === 2 && m.slot === 0)!;
    expect(match.walkover).toBe(true);
    expect(match.runLogA).toEqual([]);
  });
});

describe("the qualifying table with failed runs", () => {
  const teams = [1, 2, 3, 4].map((n) => ({ id: `t${n}`, name: `Team ${n}` }));
  const run = (id: string, log: RunEntry[], minute: number) => ({ registrationId: id, score: null, runTimes: [], runLog: log, createdAt: new Date(Date.UTC(2026, 2, 14, 8, minute)) });

  it("ranks all-successful and mixed sheets by score, then the no-success ones by the furthest cell", () => {
    const table = standings(teams, [
      run("t1", [fail(99), fail(96)], 1),
      run("t2", [ok(25), fail(98), ok(26)], 2),
      run("t3", [ok(30)], 3),
      run("t4", [fail(97)], 4),
    ]);
    expect(table.map((row) => [row.teamId, row.runs, row.failed, row.remaining])).toEqual([
      ["t2", 2, 1, null],
      ["t3", 1, 0, null],
      ["t1", 0, 2, 1],
      ["t4", 0, 1, 3],
    ]);
    expect(table[0]!.log).toEqual([ok(25), fail(98), ok(26)]);
  });
});

describe("a qualifying slot", () => {
  const config = { runOrderStart: "09:30", runSlotMinutes: 10 };
  const clock = (date: Date | null) => date && date.toISOString().slice(11, 16);

  it("is the start plus a slot per place, unless the team has its own time", () => {
    // 2026-03-14 is in Amman's UTC+3 all year.
    expect(clock(qualifyingSlot({ runOrder: 3, slotTime: "" }, config, "2026-03-14"))).toBe("06:50");
    expect(clock(qualifyingSlot({ runOrder: 3, slotTime: "11:05" }, config, "2026-03-14"))).toBe("08:05");
    expect(qualifyingSlot({ runOrder: null, slotTime: "" }, config, "2026-03-14")).toBeNull();
    expect(qualifyingSlot({ runOrder: 2, slotTime: "" }, { ...config, runOrderStart: "" }, "2026-03-14")).toBeNull();
  });
});
