import { describe, expect, it } from "vitest";
import { PLAY_ORDER, matchesAtOnce, planKnockoutSchedule, type SchedulableMatch } from "@/lib/knockout-schedule";

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
  it("plays the third place before the final, both on their own", () => {
    expect(PLAY_ORDER).toEqual([2, 3, 4, 5, 7, 6]);
    expect(matchesAtOnce(3, 2)).toBe(2);
    expect(matchesAtOnce(7, 2)).toBe(1);
    expect(matchesAtOnce(6, 2)).toBe(1);
    expect(matchesAtOnce(3, 1)).toBe(1);
  });

  it("puts two matches side by side, one per maze, round after round", () => {
    const plan = planKnockoutSchedule(bracket(), { start: "13:00", minutes: 15, breakMinutes: 10, fromRound: 3, mazes: MAZES });
    expect(plan).toHaveLength(16);
    // Round of 16: 8 matches, 4 slots of two.
    expect(at(plan, "r3m0")).toMatchObject({ time: "13:00", maze: "Maze A" });
    expect(at(plan, "r3m1")).toMatchObject({ time: "13:00", maze: "Maze B" });
    expect(at(plan, "r3m2")).toMatchObject({ time: "13:15", maze: "Maze A" });
    expect(at(plan, "r3m7")).toMatchObject({ time: "13:45", maze: "Maze B" });
    // Quarter-finals after 4 slots and a break: 13:00 + 60 + 10.
    expect(at(plan, "r4m0")).toMatchObject({ time: "14:10", maze: "Maze A" });
    expect(at(plan, "r4m3")).toMatchObject({ time: "14:25", maze: "Maze B" });
    // Semi-finals side by side.
    expect(at(plan, "r5m0")).toMatchObject({ time: "14:50", maze: "Maze A" });
    expect(at(plan, "r5m1")).toMatchObject({ time: "14:50", maze: "Maze B" });
    // The play-off, then the final, each alone on the first maze.
    expect(at(plan, "r7m0")).toMatchObject({ time: "15:15", maze: "Maze A" });
    expect(at(plan, "r6m0")).toMatchObject({ time: "15:40", maze: "Maze A" });
  });

  it("runs one match at a time with one maze", () => {
    const plan = planKnockoutSchedule(bracket(), { start: "13:00", minutes: 10, breakMinutes: 0, fromRound: 3, mazes: ["Main maze"] });
    expect(at(plan, "r3m1")).toMatchObject({ time: "13:10", maze: "Main maze" });
    expect(at(plan, "r4m0")).toMatchObject({ time: "14:20" });
  });

  it("starts from a later round and leaves the earlier ones alone", () => {
    const plan = planKnockoutSchedule(bracket(), { start: "15:00", minutes: 20, breakMinutes: 5, fromRound: 5, mazes: MAZES });
    expect(plan!.map((match) => match.id)).toEqual(["r5m0", "r5m1", "r7m0", "r6m0"]);
    expect(at(plan, "r7m0")).toMatchObject({ time: "15:25" });
    expect(at(plan, "r6m0")).toMatchObject({ time: "15:50" });
  });

  it("skips byes, walkovers and matches already played", () => {
    const plan = planKnockoutSchedule(bracket({ r3m0: { void: true }, r3m1: { done: true } }), {
      start: "13:00",
      minutes: 15,
      breakMinutes: 0,
      fromRound: 3,
      mazes: MAZES,
    });
    expect(at(plan, "r3m0")).toBeUndefined();
    expect(at(plan, "r3m1")).toBeUndefined();
    // Six left: three slots, so the quarter-finals start at 13:45.
    expect(at(plan, "r3m2")).toMatchObject({ time: "13:00", maze: "Maze A" });
    expect(at(plan, "r3m7")).toMatchObject({ time: "13:30", maze: "Maze B" });
    expect(at(plan, "r4m0")).toMatchObject({ time: "13:45" });
  });

  it("refuses a start that is not a time", () => {
    expect(planKnockoutSchedule(bracket(), { start: "1pm", minutes: 15, breakMinutes: 0, fromRound: 3, mazes: MAZES })).toBeNull();
  });
});
