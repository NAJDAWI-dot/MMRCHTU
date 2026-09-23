import { describe, expect, it } from "vitest";
import {
  compareResults,
  formatPoints,
  formatTime,
  parseRemaining,
  parseRunTime,
  scoreSheet,
  sheetFromFields,
  workingOf,
} from "@/lib/score-sheet";

describe("a match sheet", () => {
  it("works the rulebook examples out from the run times", () => {
    const four = scoreSheet({ times: [41.2, 25, 26.1, 25.4], remaining: null });
    expect(four.runs).toBe(4);
    expect(four.official).toBe(25);
    expect(formatPoints(four.score)).toBe("160.0");

    const one = scoreSheet({ times: [18], remaining: null });
    expect(formatPoints(one.score)).toBe("55.6");
    expect(compareResults(four, one)).toBeLessThan(0);
  });

  it("has no score without a successful run, and keeps the distance short", () => {
    const none = scoreSheet({ times: [], remaining: 3 });
    expect(none.score).toBeNull();
    expect(none.remaining).toBe(3);
    expect(workingOf(none)).toBe("No run reached the centre. Stopped 3 cells short.");
  });

  it("drops the distance once a run did reach the centre", () => {
    expect(scoreSheet({ times: [30], remaining: 4 }).remaining).toBeNull();
  });

  it("shows its working", () => {
    expect(workingOf(scoreSheet({ times: [25, 30], remaining: null }))).toBe("2 runs ÷ 25.0 s × 1000 = 80.0");
  });
});

describe("ranking two sheets", () => {
  const sheet = (times: number[], remaining: number | null = null) => scoreSheet({ times, remaining });

  it("puts any score above no score", () => {
    expect(compareResults(sheet([470]), sheet([], 0))).toBeLessThan(0);
    expect(compareResults(sheet([], 0), sheet([470]))).toBeGreaterThan(0);
  });

  it("settles an exact tie by the faster official time", () => {
    // 100 points each: two runs at 20 s against one at 10 s.
    expect(compareResults(sheet([20, 20]), sheet([10]))).toBeGreaterThan(0);
  });

  it("ranks the ones that never got there by distance, unrecorded last", () => {
    expect(compareResults(sheet([], 2), sheet([], 5))).toBeLessThan(0);
    expect(compareResults(sheet([], 5), sheet([]))).toBeLessThan(0);
    expect(compareResults(sheet([]), sheet([]))).toBe(0);
  });
});

describe("reading what a judge types", () => {
  it("takes seconds, a comma decimal, a unit or minutes and seconds", () => {
    expect(parseRunTime("25.4")).toBe(25.4);
    expect(parseRunTime("25,4")).toBe(25.4);
    expect(parseRunTime("25.412 s")).toBe(25.412);
    expect(parseRunTime("1:05.3")).toBe(65.3);
  });

  it("refuses what is not a time inside the match", () => {
    for (const value of ["", "fast", "0", "-3", "1:75", "481", "9:00"]) expect(parseRunTime(value)).toBeNull();
  });

  it("reads a distance in cells", () => {
    expect(parseRemaining("2,5")).toBe(2.5);
    expect(parseRemaining("")).toBeNull();
    expect(parseRemaining("-1")).toBeNull();
  });

  it("skips blank rows, and refuses the sheet over one bad row or too long a total", () => {
    const good = sheetFromFields(["30", "", "28.5"], "");
    expect(good.ok && good.sheet.times).toEqual([30, 28.5]);
    expect(sheetFromFields(["30", "oops"], "")).toEqual({ ok: false, problem: "bad-time" });
    expect(sheetFromFields(["300", "200"], "")).toEqual({ ok: false, problem: "too-long" });
  });

  it("writes a time back the way a stopwatch would", () => {
    expect(formatTime(25)).toBe("25.0 s");
    expect(formatTime(25.412)).toBe("25.412 s");
    expect(formatTime(65.3)).toBe("1:05.3");
    expect(formatTime(null)).toBe("–");
  });
});
