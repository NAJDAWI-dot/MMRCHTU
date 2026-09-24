import { describe, expect, it } from "vitest";
import {
  cleanLog,
  compareResults,
  formatPoints,
  formatTime,
  outcomeOf,
  outcomeText,
  parseRemaining,
  parseRunResult,
  parseRunTime,
  scoreSheet,
  sheetFromFields,
  workingOf,
  type RunEntry,
} from "@/lib/score-sheet";

const ok = (time: number): RunEntry => ({ ok: true, time, short: null });
const fail = (short: number | null, time: number | null = null): RunEntry => ({ ok: false, time, short });

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
    expect(workingOf(none)).toBe("No run reached the centre. The closest stopped 3 cells short.");
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
    const good = sheetFromFields(["30", "", "28.5"]);
    expect(good.ok && good.sheet.times).toEqual([30, 28.5]);
    expect(sheetFromFields(["30", "oops"])).toEqual({ ok: false, problem: "bad-time" });
    expect(sheetFromFields(["300", "200"])).toEqual({ ok: false, problem: "too-long" });
  });

  it("reads every run with its result, keeping a failed row even when it is empty", () => {
    const read = sheetFromFields(["40", "", "25.5", ""], ["no", "no", "yes", "yes"], ["3", "", "", ""]);
    expect(read.ok && read.sheet.log).toEqual([fail(3, 40), fail(null), ok(25.5)]);
    expect(sheetFromFields(["", "30"], ["no", "yes"], ["three", ""])).toEqual({ ok: false, problem: "bad-short" });
    // A failed run's time counts against the eight minutes too.
    expect(sheetFromFields(["300", "200"], ["no", "yes"], ["2", ""])).toEqual({ ok: false, problem: "too-long" });
  });

  it("reads a result the way people write one", () => {
    for (const yes of ["yes", "Success", "✓", "1", "TRUE"]) expect(parseRunResult(yes)).toBe(true);
    for (const no of ["no", "Fail", "failed", "✗", "0", "DNF"]) expect(parseRunResult(no)).toBe(false);
    expect(parseRunResult("maybe")).toBeNull();
  });

  it("writes a time back the way a stopwatch would", () => {
    expect(formatTime(25)).toBe("25.0 s");
    expect(formatTime(25.412)).toBe("25.412 s");
    expect(formatTime(65.3)).toBe("1:05.3");
    expect(formatTime(null)).toBe("–");
  });
});

describe("successful and failed runs", () => {
  it("scores a team with only successful runs on all of them", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [ok(41.2), ok(25), ok(26.1), ok(25.4)] });
    expect(outcomeOf(sheet)).toBe("all-successful");
    expect(outcomeText(sheet)).toBe("All 4 runs successful");
    expect(formatPoints(sheet.score)).toBe("160.0");
    expect(workingOf(sheet)).toBe("4 runs ÷ 25.0 s × 1000 = 160.0");
  });

  it("scores a team with some of each on its successful runs alone", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [fail(4, 60), ok(30), fail(1), ok(25)] });
    expect(outcomeOf(sheet)).toBe("mixed");
    expect(outcomeText(sheet)).toBe("2 of 4 runs successful");
    expect(sheet.runs).toBe(2);
    expect(sheet.failed).toBe(2);
    expect(sheet.official).toBe(25);
    expect(formatPoints(sheet.score)).toBe("80.0");
    // A team that reached the centre is never ranked by distance.
    expect(sheet.remaining).toBeNull();
    expect(workingOf(sheet)).toBe("2 successful runs ÷ 25.0 s × 1000 = 80.0. The 2 failed runs do not count.");
  });

  it("gives a team with no successful run no score, ranked by its closest run", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [fail(5), fail(2.5, 90), fail(null)] });
    expect(outcomeOf(sheet)).toBe("none-successful");
    expect(outcomeText(sheet)).toBe("None of 3 runs successful");
    expect(sheet.score).toBeNull();
    expect(sheet.remaining).toBe(2.5);
    expect(workingOf(sheet)).toBe("No run reached the centre in 3 runs. The closest stopped 2.5 cells short.");
  });

  it("ranks the three kinds the rulebook's way", () => {
    const all = scoreSheet({ times: [], remaining: null, log: [ok(25), ok(26)] });
    const mixed = scoreSheet({ times: [], remaining: null, log: [ok(25), fail(2), fail(1)] });
    const close = scoreSheet({ times: [], remaining: null, log: [fail(1)] });
    const far = scoreSheet({ times: [], remaining: null, log: [fail(6), fail(4)] });
    const ranked = [far, mixed, close, all].sort(compareResults);
    expect(ranked).toEqual([all, mixed, close, far]);
  });

  it("reads a sheet from before failed runs were kept the same as it always did", () => {
    const old = scoreSheet({ times: [30, 25], remaining: null, log: [] });
    expect(old.log).toEqual([ok(30), ok(25)]);
    expect(old.failed).toBe(0);
    const stopped = scoreSheet({ times: [], remaining: 3, log: [] });
    expect(stopped.log).toEqual([fail(3)]);
    expect(stopped.remaining).toBe(3);
  });

  it("cleans a stored log, dropping anything that is not a run", () => {
    expect(cleanLog([ok(25), { ok: true, time: null }, { ok: false, short: "x" }, "junk", null, { ok: "yes", time: 4 }])).toEqual([ok(25), fail(null)]);
    expect(cleanLog("not a list")).toEqual([]);
  });
});
