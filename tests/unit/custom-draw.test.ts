import { describe, expect, it } from "vitest";
import { readCell, readCustomDraw, slotClock, slotMinutesOf, type DrawTeam } from "@/lib/custom-draw";

// Made-up teams in the sheet's own shapes.
const teams: DrawTeam[] = [
  { id: "a3", name: "Hyper Team", code: "A3" },
  { id: "c8", name: "Cat & Mouse", code: "C8" },
  { id: "b6", name: "Nodez1", code: "B6" },
  { id: "f5", name: "جوردون بلو", code: "F5" },
  { id: "e2", name: "F150", code: "E2" },
  { id: "c1", name: "Aura - Z", code: "C1" },
  { id: "g0", name: "Last Bot", code: "G0" },
  { id: "x", name: "No Code Team", code: "" },
];

const sheet = [
  "time slot\tMaze B2 orange Village\tMaze B1 new soft area",
  "11:30:00\tA3 - Hyper Team\tC8 - Cat & Mouse",
  "11:40:00\tB6 - Nodez1\tجوردون بلو - F5",
  "11:50:00\tE2 - F150\tC1 - Aura - Z",
  "12:00:00\tG0 - Last Bot\t",
].join("\n");

describe("slotClock", () => {
  it("reads the sheet's times", () => {
    expect(slotClock("11:30:00")).toBe("11:30");
    expect(slotClock("9:05")).toBe("09:05");
    expect(slotClock("1:40 PM")).toBe("13:40");
    expect(slotClock("time slot")).toBeNull();
    expect(slotClock("25:00")).toBeNull();
  });
});

describe("readCell", () => {
  it("finds the code first or last, and keeps dashes inside names", () => {
    expect(readCell("A3 - Hyper Team")).toEqual({ code: "A3", name: "Hyper Team" });
    expect(readCell("جوردون بلو - F5")).toEqual({ code: "F5", name: "جوردون بلو" });
    expect(readCell("C1 - Aura - Z")).toEqual({ code: "C1", name: "Aura - Z" });
    expect(readCell("E2 - F150")).toEqual({ code: "E2", name: "F150" });
    expect(readCell("g0")).toEqual({ code: "G0", name: "" });
    expect(readCell("No Code Team")).toEqual({ code: "", name: "No Code Team" });
  });
});

describe("readCustomDraw", () => {
  it("takes the mazes from the heading and the order row by row, left to right", () => {
    const draw = readCustomDraw(sheet, teams);
    expect(draw.problems).toEqual([]);
    expect(draw.mazes).toEqual(["Maze B2 orange Village", "Maze B1 new soft area"]);
    expect(draw.rows.map((row) => row.time)).toEqual(["11:30", "11:40", "11:50", "12:00"]);
    expect(draw.rows.map((row) => row.cells.map((cell) => cell && `${cell.order}:${cell.teamId}`))).toEqual([
      ["1:a3", "2:c8"],
      ["3:b6", "4:f5"],
      ["5:e2", "6:c1"],
      ["7:g0", null],
    ]);
    expect(draw.placed).toBe(7);
    expect(draw.missing.map((team) => team.id)).toEqual(["x"]);
    expect(slotMinutesOf(draw)).toBe(10);
  });

  it("finds a team by name when the cell has no code", () => {
    const draw = readCustomDraw("10:00\tNo Code Team\tcat & mouse", teams);
    expect(draw.rows[0]!.cells.map((cell) => cell?.teamId)).toEqual(["x", "c8"]);
    expect(draw.mazes).toEqual([]);
  });

  it("says which cells it could not place, and refuses a team twice", () => {
    const draw = readCustomDraw("10:00\tZ9 - Nobody\tA3 - Hyper Team\n10:10\tA3 - Hyper Team\t\nlater\tB6", teams);
    expect(draw.problems).toEqual([
      "10:00: no team has the code Z9 or the name Nobody.",
      "10:10: Hyper Team is already at 10:00.",
      'Line 3: "later" is not a time.',
    ]);
    expect(draw.placed).toBe(1);
  });
});
