import { describe, expect, it } from "vitest";
import { MIN_EXPORT_TOKEN_LENGTH, exportTokenMatches } from "@/lib/export-token";

const VALID = "a".repeat(MIN_EXPORT_TOKEN_LENGTH);

describe("exportTokenMatches", () => {
  it("accepts the configured token", () => {
    expect(exportTokenMatches(VALID, VALID)).toBe(true);
  });

  it("rejects a different token of the same length", () => {
    expect(exportTokenMatches("b".repeat(MIN_EXPORT_TOKEN_LENGTH), VALID)).toBe(false);
  });

  it("rejects a token of a different length without throwing", () => {
    // timingSafeEqual throws on mismatched lengths, so the guard before it is
    // what keeps a short guess from becoming a 500 instead of a refusal.
    expect(exportTokenMatches("short", VALID)).toBe(false);
    expect(exportTokenMatches(VALID + "x", VALID)).toBe(false);
  });

  it("matches nothing at all when no token is configured", () => {
    // Otherwise switching the feed off would turn it into an open endpoint
    // serving every registrant's personal data.
    expect(exportTokenMatches("anything", undefined)).toBe(false);
    expect(exportTokenMatches("anything", null)).toBe(false);
    expect(exportTokenMatches("", "")).toBe(false);
    expect(exportTokenMatches("", undefined)).toBe(false);
    expect(exportTokenMatches(undefined, undefined)).toBe(false);
  });

  it("refuses a configured token that is too short to be worth anything", () => {
    // A placeholder someone pasted in while experimenting must not silently
    // become production's only protection.
    const weak = "letmein";
    expect(exportTokenMatches(weak, weak)).toBe(false);
    expect(exportTokenMatches("a".repeat(MIN_EXPORT_TOKEN_LENGTH - 1), "a".repeat(MIN_EXPORT_TOKEN_LENGTH - 1))).toBe(false);
  });

  it("ignores surrounding whitespace in the configured value", () => {
    // A trailing newline in a .env file is a typo, not a different secret.
    expect(exportTokenMatches(VALID, `  ${VALID}\n`)).toBe(true);
  });

  it("does not trim the supplied value, which arrives from a URL", () => {
    expect(exportTokenMatches(` ${VALID}`, VALID)).toBe(false);
  });
});
