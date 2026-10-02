import { describe, expect, it } from "vitest";
import { MAZE_CELLS, checkLog, scoreSheet } from "@/lib/score-sheet";
import { randomSheet } from "@/lib/test-data";

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

describe("random test sheets", () => {
  const sheets = Array.from({ length: 500 }, (_, i) => randomSheet(seeded(i + 1)));

  it("are always sheets the desk would accept", () => {
    for (const log of sheets) {
      expect(log.length).toBeGreaterThan(0);
      expect(log.filter((run) => !run.ret).length).toBeLessThanOrEqual(6);
      expect(checkLog(log)).toBeNull();
      for (const run of log) {
        if (run.ok) expect(run.time).toBeGreaterThan(0);
        else if (run.ret) expect(run.time).toBeNull();
        else {
          expect(run.time).toBeNull();
          expect(run.cell).toBeGreaterThanOrEqual(1);
          expect(run.cell).toBeLessThan(MAZE_CELLS);
        }
      }
    }
  });

  it("include returns, made and missed, some of them the official time", () => {
    const results = sheets.map((log) => scoreSheet({ times: [], remaining: null, log }));
    expect(results.some((sheet) => sheet.returns > 0)).toBe(true);
    expect(results.some((sheet) => sheet.failedReturns > 0)).toBe(true);
    expect(results.some((sheet) => sheet.returnTimes.includes(sheet.official ?? -1))).toBe(true);
  });

  it("cover all three kinds of sheet", () => {
    const kinds = new Set(
      sheets.map((log) => {
        const sheet = scoreSheet({ times: [], remaining: null, log });
        return sheet.runs === 0 ? "none" : sheet.failed === 0 ? "all" : "mixed";
      }),
    );
    expect([...kinds].sort()).toEqual(["all", "mixed", "none"]);
  });
});
