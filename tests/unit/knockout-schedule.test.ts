import { describe, expect, it } from "vitest";
import { PLAY_ORDER, headToHead, planKnockoutSchedule, type SchedulableMatch } from "@/lib/knockout-schedule";

const MAZES = ["Maze A", "Maze B"];

/** A bracket from the round of 16: 8, 4, 2 matches, the play-off and the final. */
function bracket(overrides: Partial<Record<string, Partial<SchedulableMatch>>> = {}): SchedulableMatch[] {
  const out: SchedulableMatch[] = [];
  for (const [round, count] of [[3, 8], [4, 4], [5, 2], [7, 1], [6, 1]] as const) {
    for (let slot = 0; slot < count; slot++) {
      const id = `r${round}m${slot}`;
      out.push({ id, round, slot, void: false, done: false, ...overrides[id] });
    }
  }
  return out;
}

const at = (plan: ReturnType<typeof planKnockoutSchedule>, id: string) => plan!.find((match) => match.id === id);

describe("planKnockoutSchedule", () => {
  it("plays the third place before the final", () => {
    expect(PLAY_ORDER).toEqual([2, 3, 4, 5, 7, 6]);
  });

  it("puts the two teams of a match head to head, one per maze", () => {
    expect(headToHead(MAZES)).toEqual({ mazeA: "Maze A", mazeB: "Maze B" });
    expect(headToHead(["Main maze"])).toEqual({ mazeA: "Main maze", mazeB: "Main maze" });
    expect(headToHead([])).toEqual({ mazeA: "", mazeB: "" });
  });

  it("plays the matches one after another, round after round, the final too", () => {
    const plan = planKnockoutSchedule(bracket(), { start: "13:00", minutes: 10, breakMinutes: 15, fromRound: 3, mazes: MAZES });
    expect(plan).toHaveLength(16);
    expect(plan!.every((match) => match.mazeA === "Maze A" && match.mazeB === "Maze B")).toBe(true);
    // Round of 16: 8 matches, ten minutes apart.
    expect(at(plan, "r3m0")!.time).toBe("13:00");
    expect(at(plan, "r3m1")!.time).toBe("13:10");
    expect(at(plan, "r3m7")!.time).toBe("14:10");
    // Quarter-finals after the eighth match and a break: 13:00 + 80 + 15.
    expect(at(plan, "r4m0")!.time).toBe("14:35");
    expect(at(plan, "r4m3")!.time).toBe("15:05");
    expect(at(plan, "r5m0")!.time).toBe("15:30");
    expect(at(plan, "r5m1")!.time).toBe("15:40");
    expect(at(plan, "r7m0")!.time).toBe("16:05");
    expect(at(plan, "r6m0")!.time).toBe("16:30");
  });

  it("starts from a later round and leaves the earlier ones alone", () => {
    const plan = planKnockoutSchedule(bracket(), { start: "15:00", minutes: 20, breakMinutes: 5, fromRound: 5, mazes: MAZES });
    expect(plan!.map((match) => match.id)).toEqual(["r5m0", "r5m1", "r7m0", "r6m0"]);
    expect(at(plan, "r5m1")!.time).toBe("15:20");
    expect(at(plan, "r7m0")!.time).toBe("15:45");
    expect(at(plan, "r6m0")!.time).toBe("16:10");
  });

  it("skips byes, walkovers and matches already played", () => {
    const plan = planKnockoutSchedule(bracket({ r3m0: { void: true }, r3m1: { done: true } }), {
      start: "13:00",
      minutes: 10,
      breakMinutes: 0,
      fromRound: 3,
      mazes: MAZES,
    });
    expect(at(plan, "r3m0")).toBeUndefined();
    expect(at(plan, "r3m1")).toBeUndefined();
    expect(at(plan, "r3m2")!.time).toBe("13:00");
    expect(at(plan, "r4m0")!.time).toBe("14:00");
  });

  it("refuses a start that is not a time", () => {
    expect(planKnockoutSchedule(bracket(), { start: "1pm", minutes: 15, breakMinutes: 0, fromRound: 3, mazes: MAZES })).toBeNull();
  });
});
