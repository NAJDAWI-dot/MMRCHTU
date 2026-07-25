import { describe, expect, it } from "vitest";
import {
  COMPETITION_DAY_STATUSES,
  isCompetitionDayStatus,
  parseStatus,
  toParagraphs,
} from "@/lib/competition-day";

describe("parseStatus", () => {
  it("accepts the three supported statuses, case-insensitively", () => {
    expect(parseStatus("PUBLISHED")).toBe("PUBLISHED");
    expect(parseStatus("hidden")).toBe("HIDDEN");
    expect(parseStatus("Coming_Soon")).toBe("COMING_SOON");
  });

  it("falls back to COMING_SOON for unknown or missing values", () => {
    // Failing closed matters here: an unreadable status must never be treated
    // as PUBLISHED and leak unreleased details.
    expect(parseStatus("nonsense")).toBe("COMING_SOON");
    expect(parseStatus(undefined)).toBe("COMING_SOON");
    expect(parseStatus(null)).toBe("COMING_SOON");
    expect(parseStatus("")).toBe("COMING_SOON");
  });

  it("agrees with the type guard on every supported status", () => {
    for (const status of COMPETITION_DAY_STATUSES) {
      expect(isCompetitionDayStatus(status)).toBe(true);
      expect(parseStatus(status)).toBe(status);
    }
    expect(isCompetitionDayStatus("DRAFT")).toBe(false);
  });
});

describe("toParagraphs", () => {
  it("splits on blank lines and trims each paragraph", () => {
    expect(toParagraphs("Check-in opens at 09:00.\n\n  Qualifying begins at 11:00. ")).toEqual([
      "Check-in opens at 09:00.",
      "Qualifying begins at 11:00.",
    ]);
  });

  it("keeps single newlines inside a paragraph", () => {
    expect(toParagraphs("Line one\nLine two")).toEqual(["Line one\nLine two"]);
  });

  it("tolerates blank lines with stray whitespace and returns nothing for empty text", () => {
    expect(toParagraphs("A\n \t \nB")).toEqual(["A", "B"]);
    expect(toParagraphs("   \n\n  ")).toEqual([]);
    expect(toParagraphs("")).toEqual([]);
  });
});
