import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { scoreSheet, type RunEntry } from "@/lib/score-sheet";
import {
  SCORE_HEADERS,
  TIMING_HEADERS,
  parsePhase,
  readScoreFile,
  readTimingFile,
  scoreRows,
  standingsRow,
} from "@/lib/score-transfer";

const TEAMS = [
  { id: "t1", name: "Maze Runners" },
  { id: "t2", name: "Byte Mice" },
  { id: "t3", name: "=Sneaky" },
];
const ok = (time: number): RunEntry => ({ ok: true, time, short: null });
const fail = (short: number | null, time: number | null = null): RunEntry => ({ ok: false, time, short });

describe("reading a CSV", () => {
  it("reads quotes, doubled quotes and line breaks inside quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",z\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["two\nlines", "z"],
    ]);
  });

  it("takes the separator from the header, as Excel saves it in much of the world", () => {
    expect(parseCsv("Team;Time\nMaze Runners;25,4\n")).toEqual([
      ["Team", "Time"],
      ["Maze Runners", "25,4"],
    ]);
    expect(parseCsv("Team\tTime\nA\t1\n")).toEqual([
      ["Team", "Time"],
      ["A", "1"],
    ]);
  });

  it("drops blank lines and the byte-order mark", () => {
    expect(parseCsv("﻿a,b\n\n,\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("reads back what the export wrote, formula guard and all", () => {
    const csv = toCsv(["Team", "Note"], [["=Sneaky", "-3 cells"]]);
    expect(parseCsv(csv)).toEqual([
      ["Team", "Note"],
      ["=Sneaky", "-3 cells"],
    ]);
  });
});

describe("phases", () => {
  it("reads a phase however it is written", () => {
    expect(parsePhase("Qualifying")).toBe(1);
    expect(parsePhase("round of 32")).toBe(2);
    expect(parsePhase("R16")).toBe(3);
    expect(parsePhase("Quarter-finals")).toBe(4);
    expect(parsePhase("quarter final")).toBe(4);
    expect(parsePhase("Semi-finals")).toBe(5);
    expect(parsePhase("Final")).toBe(6);
    expect(parsePhase("Phase 3")).toBe(3);
    expect(parsePhase("7")).toBeNull();
    expect(parsePhase("Group stage")).toBeNull();
  });
});

describe("the scores file", () => {
  it("writes one row per run, successful or not", () => {
    const sheet = scoreSheet({ times: [], remaining: null, log: [fail(3, 40), ok(25.5)] });
    expect(scoreRows(1, null, TEAMS[0]!, sheet, sheet.score, "touched on run 1")).toEqual([
      ["Qualifying", "", "t1", "Maze Runners", 1, "Fail", 40, 3, "39.2", "touched on run 1"],
      ["Qualifying", "", "t1", "Maze Runners", 2, "Success", 25.5, "", "39.2", ""],
    ]);
  });

  it("reads back exactly what it wrote", () => {
    const a = scoreSheet({ times: [], remaining: null, log: [fail(3, 40), ok(25.5), ok(30)] });
    const b = scoreSheet({ times: [], remaining: null, log: [fail(2), fail(1.5)] });
    const knockout = scoreSheet({ times: [], remaining: null, log: [ok(22)] });
    const csv = toCsv(SCORE_HEADERS, [
      ...scoreRows(1, null, TEAMS[0]!, a, a.score, "note"),
      ...scoreRows(1, null, TEAMS[1]!, b, b.score),
      ...scoreRows(2, 4, TEAMS[2]!, knockout, knockout.score),
    ]);
    const read = readScoreFile(csv, TEAMS);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.runs).toBe(6);
    expect(read.qualifying.map((item) => [item.team.id, item.log, item.note])).toEqual([
      ["t1", a.log, "note"],
      ["t2", b.log, ""],
    ]);
    expect(read.knockout.map((item) => [item.round, item.slot, item.team.id, item.log])).toEqual([[2, 3, "t3", [ok(22)]]]);
  });

  it("takes a hand-made sheet: names instead of IDs, any order, a result left out", () => {
    const csv = ["Team,Run,Result,Time,Cells short", "byte mice,2,,31.5,", "Byte Mice,1,fail,,4", "Maze Runners,1,✗,,2"].join("\n");
    const read = readScoreFile(csv, TEAMS);
    expect(read.ok && read.qualifying.map((item) => [item.team.id, item.log])).toEqual([
      ["t2", [fail(4), ok(31.5)]],
      ["t1", [fail(2)]],
    ]);
    // No Note column: the notes the sheets have are kept.
    expect(read.ok && read.qualifying.every((item) => item.note === null)).toBe(true);
  });

  it("refuses the whole file with the lines to fix", () => {
    const csv = [
      "Phase,Match,Team,Result,Time (s),Cells short",
      "Qualifying,,Nobody,Success,25,",
      "Qualifying,,Maze Runners,Success,,",
      "Qualifying,,Maze Runners,Maybe,20,",
      "Round of 32,17,Byte Mice,Success,20,",
      "Semis,,Byte Mice,Success,20,",
      "Qualifying,,Byte Mice,Fail,,lots",
      "Qualifying,,Byte Mice,Success,9:99,",
    ].join("\n");
    const read = readScoreFile(csv, TEAMS);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.errors).toEqual([
      'Line 2: there is no confirmed team called "Nobody".',
      "Line 3: a successful run needs its time.",
      'Line 4: "Maybe" is not a result. Use Success or Fail.',
      "Line 5: Round of 32 needs a match number from 1 to 16.",
      'Line 6: "Semis" is not a phase. Use Qualifying, Round of 32, Round of 16, Quarter-finals, Semi-finals or Final.',
      'Line 7: "lots" is not a number of cells.',
      'Line 8: "9:99" is not a run time. Use seconds, like 25.41, inside the 8 minutes.',
    ]);
  });

  it("refuses a team's runs that add up to more than the match", () => {
    const csv = ["Team,Result,Time", "Maze Runners,Success,300", "Maze Runners,Fail,200"].join("\n");
    const read = readScoreFile(csv, TEAMS);
    expect(!read.ok && read.errors[0]).toMatch(/^Line 2: Maze Runners\. Those runs add up to more than the eight minute match/);
  });

  it("tells two teams with the same name apart only by ID", () => {
    const teams = [...TEAMS, { id: "t4", name: "Maze Runners" }];
    const read = readScoreFile("Team,Time\nMaze Runners,25", teams);
    expect(!read.ok && read.errors[0]).toMatch(/more than one team is called "Maze Runners"/);
    const byId = readScoreFile("Team ID,Team,Time\nt4,Maze Runners,25", teams);
    expect(byId.ok && byId.qualifying[0]!.team.id).toBe("t4");
  });

  it("needs a team and a result or time column", () => {
    expect(readScoreFile("", TEAMS)).toEqual({ ok: false, errors: ["The file is empty."] });
    expect(readScoreFile("Name,Points\nA,1", TEAMS)).toEqual({ ok: false, errors: ["The first line should be the column names, like the ones in an export."] });
    expect(readScoreFile("Team,Note\nMaze Runners,x", TEAMS)).toEqual({ ok: false, errors: ["The file needs a Result or Time column."] });
    expect(readScoreFile("Team,Time\nMaze Runners,", TEAMS)).toEqual({ ok: false, errors: ["The file has no runs in it."] });
  });
});

describe("the standings file", () => {
  it("writes the table with the runs in words", () => {
    expect(
      standingsRow({ rank: 3, teamId: "t1", name: "Maze Runners", best: 80, runs: 2, failed: 1, official: 25, remaining: null, qualified: true }),
    ).toEqual([3, "t1", "Maze Runners", "80.0", 2, 1, 25, "", "2 of 3 runs successful", "yes"]);
  });
});

describe("the timings file", () => {
  it("reads qualifying places and times, and knockout times and mazes", () => {
    const csv = toCsv(TIMING_HEADERS, [
      ["Qualifying", "", 1, "t1", "Maze Runners", "", "09:30", ""],
      ["Qualifying", "", 2, "t2", "Byte Mice", "", "9.45", ""],
      ["Qualifying", "", "", "t3", "=Sneaky", "", "", ""],
      ["Round of 32", 1, "", "t1", "Maze Runners", "Byte Mice", "14:20", "Maze A"],
      ["Final", 1, "", "", "", "", "", ""],
    ]);
    const read = readTimingFile(csv, TEAMS);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.qualifying.map((row) => [row.team.id, row.order, row.time])).toEqual([
      ["t1", 1, "09:30"],
      ["t2", 2, "09:45"],
      ["t3", null, ""],
    ]);
    expect(read.knockout.map((row) => [row.round, row.slot, row.time, row.maze])).toEqual([
      [2, 0, "14:20", "Maze A"],
      [6, 0, "", ""],
    ]);
  });

  it("refuses bad times, places given twice and a team listed twice", () => {
    const csv = [
      "Phase,Match,Order,Team,Time",
      "Qualifying,,1,Maze Runners,25:00",
      "Qualifying,,1,Maze Runners,09:30",
      "Qualifying,,1,Byte Mice,09:40",
      "Qualifying,,2,Maze Runners,09:50",
      "Qualifying,,first,=Sneaky,",
      "Final,2,,,",
    ].join("\n");
    const read = readTimingFile(csv, TEAMS);
    expect(!read.ok && read.errors).toEqual([
      'Line 2: "25:00" is not a time. Use 24-hour time, like 09:40.',
      "Line 4: place 1 is already given to line 3.",
      "Line 5: Maze Runners is already on line 3.",
      'Line 6: "first" is not a place in the running order.',
      "Line 7: Final needs a match number from 1 to 1.",
    ]);
  });
});
