import { describe, expect, it } from "vitest";
import {
  checkLog,
  cleanLog,
  compareResults,
  formatPoints,
  formatTime,
  outcomeOf,
  outcomeText,
  parseCell,
  parseResultKind,
  parseRunResult,
  parseRunTime,
  scoreSheet,
  sheetFromFields,
  workingOf,
  type RunEntry,
} from "@/lib/score-sheet";

const ok = (time: number): RunEntry => ({ ok: true, time, cell: null });
const fail = (cell: number | null): RunEntry => ({ ok: false, time: null, cell });

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

  it("has no score without a successful run, and keeps how far it got", () => {
    const none = scoreSheet({ times: [], remaining: 3 });
    expect(none.score).toBeNull();
    expect(none.remaining).toBe(3);
    expect(workingOf(none)).toBe("No run reached the centre. The furthest reached cell 97 of 100.");
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

  it("reads the cell a failed run reached, 1 to 99", () => {
    expect(parseCell("72")).toBe(72);
    expect(parseCell(" Cell 5 ")).toBe(5);
    expect(parseCell("99")).toBe(99);
    // Cell 100 is the centre: that run was successful.
    for (const value of ["", "0", "100", "150", "7.5", "-3", "far"]) expect(parseCell(value)).toBeNull();
  });

  it("skips blank rows, and refuses the sheet over one bad row or too long a total", () => {
    const good = sheetFromFields(["30", "", "28.5"]);
    expect(good.ok && good.sheet.times).toEqual([30, 28.5]);
    expect(sheetFromFields(["30", "oops"])).toEqual({ ok: false, problem: "bad-time" });
    expect(sheetFromFields(["300", "200"])).toEqual({ ok: false, problem: "too-long" });
  });

  it("reads every run with its result, keeping a failed row even when it is empty", () => {
    const read = sheetFromFields(["", "", "25.5", ""], ["no", "no", "yes", "yes"], ["72", "", "", ""]);
    expect(read.ok && read.sheet.log).toEqual([fail(72), fail(null), ok(25.5)]);
    expect(sheetFromFields(["", "30"], ["no", "yes"], ["seventy", ""])).toEqual({ ok: false, problem: "bad-cell" });
    expect(sheetFromFields([""], ["no"], ["100"])).toEqual({ ok: false, problem: "bad-cell" });
    // A failed run is read by its cell only: a stray time on it is not kept.
    const stray = sheetFromFields(["40"], ["no"], ["60"]);
    expect(stray.ok && stray.sheet.log).toEqual([fail(60)]);
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
    const sheet = scoreSheet({ times: [], remaining: null, log: [fail(40), ok(30), fail(88), ok(25)] });
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

  it("gives a team with no successful run no score, ranked by the furthest cell it reached", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [fail(45), fail(81), fail(null)] });
    expect(outcomeOf(sheet)).toBe("none-successful");
    expect(outcomeText(sheet)).toBe("None of 3 runs successful");
    expect(sheet.score).toBeNull();
    expect(sheet.remaining).toBe(19);
    expect(workingOf(sheet)).toBe("No run reached the centre in 3 runs. The furthest reached cell 81 of 100.");
  });

  it("ranks the three kinds the rulebook's way", () => {
    const all = scoreSheet({ times: [], remaining: null, log: [ok(25), ok(26)] });
    const mixed = scoreSheet({ times: [], remaining: null, log: [ok(25), fail(98), fail(99)] });
    const close = scoreSheet({ times: [], remaining: null, log: [fail(90)] });
    const far = scoreSheet({ times: [], remaining: null, log: [fail(30), fail(60)] });
    const ranked = [far, mixed, close, all].sort(compareResults);
    expect(ranked).toEqual([all, mixed, close, far]);
  });

  it("reads a sheet from before failed runs were kept the same as it always did", () => {
    const old = scoreSheet({ times: [30, 25], remaining: null, log: [] });
    expect(old.log).toEqual([ok(30), ok(25)]);
    expect(old.failed).toBe(0);
    const stopped = scoreSheet({ times: [], remaining: 3, log: [] });
    expect(stopped.log).toEqual([fail(97)]);
    expect(stopped.remaining).toBe(3);
  });

  it("cleans a stored log, dropping anything that is not a run", () => {
    expect(cleanLog([ok(25), { ok: true, time: null }, { ok: false, cell: "x" }, "junk", null, { ok: "yes", time: 4 }])).toEqual([ok(25), fail(null)]);
    expect(cleanLog("not a list")).toEqual([]);
  });

  it("reads a failed run saved as cells short of the centre as the cell it reached", () => {
    expect(cleanLog([{ ok: false, time: 40, short: 3 }])).toEqual([fail(97)]);
  });
});

describe("returns (rulebook version 3)", () => {
  const back = (time: number): RunEntry => ({ ok: true, time, cell: null, ret: true });
  const notBack: RunEntry = { ok: false, time: null, cell: null, ret: true };

  it("scores the rulebook's Team C: one run, one return, the return as the official time", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [ok(20), back(18)] });
    expect(sheet.runs).toBe(1);
    expect(sheet.returns).toBe(1);
    expect(sheet.official).toBe(18);
    expect(formatPoints(sheet.score)).toBe("138.9");
    expect(workingOf(sheet)).toBe("(1 run + 1.5 × 1 return) ÷ 18.0 s × 1000 = 138.9");
    expect(outcomeText(sheet)).toBe("1 run, successful, 1 return");
  });

  it("does not count a failed return, or one that does not follow a successful run", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [ok(30), notBack, fail(40), back(12)] });
    expect(sheet.returns).toBe(0);
    expect(sheet.failedReturns).toBe(1);
    expect(sheet.failed).toBe(1);
    expect(sheet.official).toBe(30);
    expect(checkLog([ok(30), notBack])).toBeNull();
    expect(checkLog([fail(40), back(12)])).toBe("bad-return");
    expect(checkLog([back(12)])).toBe("bad-return");
  });

  it("keeps a sheet with no returns scored exactly as before", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [ok(25), ok(30), ok(28), ok(26)] });
    expect(formatPoints(sheet.score)).toBe("160.0");
    expect(workingOf(sheet)).toBe("4 runs ÷ 25.0 s × 1000 = 160.0");
  });

  it("reads returns from form fields and from a stored log", () => {
    const parsed = sheetFromFields(["20", "18", "31", ""], ["yes", "yes", "yes", "no"], ["", "", "", ""], ["run", "return", "run", "return"]);
    expect(parsed.ok && parsed.sheet.log).toEqual([ok(20), back(18), ok(31), notBack]);
    // A failed return straight after a return is out of place too.
    expect(sheetFromFields(["20", "18", ""], ["yes", "yes", "no"], [], ["run", "return", "return"])).toEqual({ ok: false, problem: "bad-return" });
    expect(sheetFromFields(["18"], ["yes"], [""], ["return"])).toEqual({ ok: false, problem: "bad-return" });
    expect(cleanLog([{ ok: true, time: 18, ret: true }, { ok: false, ret: true, cell: 5 }])).toEqual([back(18), notBack]);
  });

  it("reads a return written in a score file", () => {
    expect(parseResultKind("Return")).toEqual({ ok: true, ret: true });
    expect(parseResultKind("return fail")).toEqual({ ok: false, ret: true });
    expect(parseResultKind("Success")).toEqual({ ok: true, ret: false });
    expect(parseResultKind("maybe")).toBeNull();
  });
});
