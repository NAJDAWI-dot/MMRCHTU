import { describe, expect, it } from "vitest";
import { parseContactInput, parseListKind, isValidEmail } from "@/lib/broadcast";

describe("parseContactInput", () => {
  it("parses one address per line", () => {
    const { contacts, invalid } = parseContactInput("ada@example.com\ngrace@example.com");
    expect(contacts).toEqual([
      { email: "ada@example.com", name: "" },
      { email: "grace@example.com", name: "" },
    ]);
    expect(invalid).toEqual([]);
  });

  it("parses `Name <email>` and comma/semicolon separated input", () => {
    const { contacts } = parseContactInput("Ada Lovelace <ada@example.com>; grace@example.com, Alan <alan@example.com>");
    expect(contacts).toEqual([
      { email: "ada@example.com", name: "Ada Lovelace" },
      { email: "grace@example.com", name: "" },
      { email: "alan@example.com", name: "Alan" },
    ]);
  });

  it("lower-cases addresses and drops duplicates, keeping the first name seen", () => {
    const { contacts } = parseContactInput("Ada <ADA@Example.com>\nada@example.com\nSomeone Else <Ada@EXAMPLE.COM>");
    expect(contacts).toEqual([{ email: "ada@example.com", name: "Ada" }]);
  });

  it("reports fragments that are not addresses instead of silently dropping them", () => {
    const { contacts, invalid } = parseContactInput("ada@example.com\nnot-an-email\n@nope");
    expect(contacts).toHaveLength(1);
    expect(invalid).toEqual(["not-an-email", "@nope"]);
  });

  it("returns nothing for blank input", () => {
    expect(parseContactInput("   \n\n , ; ")).toEqual({ contacts: [], invalid: [] });
  });
});

describe("parseListKind", () => {
  it("accepts the three supported kinds, case-insensitively", () => {
    expect(parseListKind("CONFIRMED")).toBe("CONFIRMED");
    expect(parseListKind("waiting")).toBe("WAITING");
    expect(parseListKind("CUSTOM")).toBe("CUSTOM");
  });

  it("falls back to CUSTOM for unknown or missing values", () => {
    expect(parseListKind("nonsense")).toBe("CUSTOM");
    expect(parseListKind(undefined)).toBe("CUSTOM");
    expect(parseListKind(null)).toBe("CUSTOM");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses and rejects obvious junk", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail(" ada@example.co.uk ")).toBe(true);
    expect(isValidEmail("ada@example")).toBe(false);
    expect(isValidEmail("ada example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});
