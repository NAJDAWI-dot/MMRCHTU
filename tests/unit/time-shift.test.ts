import { describe, expect, it } from "vitest";
import { addMinutes, drawnClock, minutesBetween, planShift } from "@/lib/time-shift";

describe("clock arithmetic", () => {
  it("moves a time either way", () => {
    expect(addMinutes("09:40", 15)).toBe("09:55");
    expect(addMinutes("09:40", 25)).toBe("10:05");
    expect(addMinutes("09:40", -45)).toBe("08:55");
    expect(addMinutes("23:50", 20)).toBe("00:10");
    expect(addMinutes("nonsense", 5)).toBeNull();
    expect(addMinutes("25:00", 5)).toBeNull();
  });

  it("measures the short way round", () => {
    expect(minutesBetween("09:40", "09:55")).toBe(15);
    expect(minutesBetween("09:55", "09:40")).toBe(-15);
    expect(minutesBetween("23:50", "00:10")).toBe(20);
    expect(minutesBetween("09:40", "x")).toBeNull();
  });

  it("works out where the draw put a place", () => {
    expect(drawnClock("09:30", 10, 1)).toBe("09:30");
    expect(drawnClock("09:30", 10, 7)).toBe("10:30");
  });
});

describe("planShift", () => {
  const teams = [
    { id: "a", runOrder: 1, slot: "09:30" },
    { id: "b", runOrder: 2, slot: "09:40" },
    { id: "c", runOrder: 3, slot: "09:50" },
    { id: "d", runOrder: 4, slot: "10:00" },
    { id: "late", runOrder: null, slot: "" },
  ];

  it("moves every team from a place onwards, and nobody before it", () => {
    expect(planShift(teams, 3, 15)).toEqual([
      { id: "c", slotTime: "10:05" },
      { id: "d", slotTime: "10:15" },
    ]);
  });

  it("can pull times earlier", () => {
    expect(planShift(teams, 1, -10)).toEqual([
      { id: "a", slotTime: "09:20" },
      { id: "b", slotTime: "09:30" },
      { id: "c", slotTime: "09:40" },
      { id: "d", slotTime: "09:50" },
    ]);
  });

  it("leaves out teams with no place in the order", () => {
    expect(planShift(teams, 1, 5).some((move) => move.id === "late")).toBe(false);
  });

  it("builds on a shift already made", () => {
    const once = planShift(teams, 2, 10);
    const moved = teams.map((team) => ({ ...team, slot: once.find((move) => move.id === team.id)?.slotTime ?? team.slot }));
    expect(planShift(moved, 4, 5)).toEqual([{ id: "d", slotTime: "10:15" }]);
  });
});
