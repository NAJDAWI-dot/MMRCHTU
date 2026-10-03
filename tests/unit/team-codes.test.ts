import { describe, expect, it } from "vitest";
import { nameKey, parseCodeList, phonesIn, planCodes, type CodeTeam } from "@/lib/team-codes";

// Made-up teams and numbers only: the real sheet is never committed.
const teams: CodeTeam[] = [
  { id: "rat", name: "Rat", code: "", phones: ["0790000001"] },
  { id: "ratatouille", name: "Ratatouille", code: "T31", phones: ["+962 790000002"] },
  { id: "orbit", name: "ORBIT", code: "", phones: ["790000003"] },
  { id: "arabic", name: "حيدرة", code: "", phones: ["790000004"] },
  { id: "renamed", name: "Some Other Name", code: "", phones: ["0790000005"] },
  { id: "holder", name: "Old Holder", code: "A1", phones: [] },
];

describe("phonesIn", () => {
  it("reads whole numbers and numbers written in groups", () => {
    expect(phonesIn("Zaid Issa +962790000001 Hanna 790000002".split(" "))).toEqual(["790000001", "790000002"]);
    expect(phonesIn("Rashed Albaz +962 7 9000 0003".split(" "))).toEqual(["790000003"]);
    expect(phonesIn("07 9000 0004".split(" "))).toEqual(["790000004"]);
  });

  it("ignores short numbers and a number a spreadsheet has mangled", () => {
    expect(phonesIn("FiveSense 01 Loading 70000000 9.63E+11".split(" "))).toEqual([]);
  });
});

describe("nameKey", () => {
  it("ignores case, spacing, punctuation and Arabic spelling variants", () => {
    expect(nameKey("  Aura - X ")).toBe(nameKey("aura x"));
    expect(nameKey("حيدرة")).toBe(nameKey("حيدره"));
  });
});

describe("parseCodeList", () => {
  it("reads rows copied from the sheet, skipping the header and group cells", () => {
    const paste = [
      "\t\tID\tTeam name\tMember 1 first name\tMember 1 WhatsApp",
      "Farah\t\tA0\tRat\tZaid\t+962 7 9000 0001",
      "\t\ta1\tORBIT\tMohammad\t790000003",
    ].join("\n");
    expect(parseCodeList(paste)).toEqual([
      { code: "A0", name: "Rat", text: "Rat Zaid +962 7 9000 0001", phones: ["790000001"] },
      { code: "A1", name: "ORBIT", text: "ORBIT Mohammad 790000003", phones: ["790000003"] },
    ]);
  });

  it("reads text copied from the PDF, where one code runs to the next", () => {
    const rows = parseCodeList("ID Team name Farah\nA0 Rat Bassam 790000001 A1 Ratatouille Aliaa 790000002\nAlisar\nB0 ORBIT");
    expect(rows.map((row) => [row.code, row.name, row.text, row.phones])).toEqual([
      ["A0", null, "Rat Bassam 790000001", ["790000001"]],
      ["A1", null, "Ratatouille Aliaa 790000002 Alisar", ["790000002"]],
      ["B0", null, "ORBIT", []],
    ]);
  });

  it("does not read a team name like F150 as a code", () => {
    expect(parseCodeList("E2 F150 baker").map((row) => row.code)).toEqual(["E2"]);
  });
});

describe("planCodes", () => {
  it("matches by name, by number, and an Arabic name copied back to front", () => {
    const plan = planCodes(parseCodeList("A0 Rat Bassam A1 Ratatouille A2 Renamed Team 0790000005 A3 ةرديح A4 ORBIT"), teams);
    expect(plan.assign.map((row) => [row.code, row.teamId, row.via, row.before])).toEqual([
      ["A0", "rat", "name", ""],
      ["A1", "ratatouille", "name", "T31"],
      ["A2", "renamed", "number", ""],
      ["A3", "arabic", "name", ""],
      ["A4", "orbit", "name", ""],
    ]);
    expect(plan.unmatched).toEqual([]);
    // Old Holder has A1, which now goes to Ratatouille.
    expect(plan.clear).toEqual([{ teamId: "holder", teamName: "Old Holder", code: "A1" }]);
    expect(plan.notListed).toEqual([{ teamName: "Old Holder", code: "" }]);
  });

  it("refuses a row whose name and numbers point at different teams", () => {
    const plan = planCodes(parseCodeList("B0\tRat\t790000003"), teams);
    expect(plan.assign).toEqual([]);
    expect(plan.unmatched[0]!.reason).toBe("The name is Rat but the numbers belong to ORBIT.");
  });

  it("refuses a team found twice and a code used twice", () => {
    const plan = planCodes(parseCodeList("B0\tRat\nB1\tRat\nB0\tORBIT"), teams);
    expect(plan.assign.map((row) => row.code)).toEqual(["B0"]);
    expect(plan.unmatched.map((row) => row.reason)).toEqual(["Rat already has B0 from this list.", "B0 is on the list twice. Only the first is used."]);
  });

  it("says when nothing matches", () => {
    const plan = planCodes(parseCodeList("C0\tNobody\t790009999"), teams);
    expect(plan.unmatched).toEqual([{ code: "C0", label: "Nobody", reason: "No confirmed team has this name or any of these numbers." }]);
    expect(plan.notListed).toHaveLength(teams.length);
  });
});
