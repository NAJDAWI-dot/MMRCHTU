import { describe, expect, it } from "vitest";
import {
  isAmbassadorStatus,
  normaliseReferralCode,
  referralCodeError,
  referralCodeFormatProblem,
  suggestReferralCode,
  validateAmbassador,
} from "@/lib/referral";

describe("normaliseReferralCode", () => {
  it("ignores case and spaces", () => {
    expect(normaliseReferralCode("  htu omar ")).toBe("HTUOMAR");
    expect(normaliseReferralCode("htu-omar")).toBe("HTU-OMAR");
  });

  it("returns empty for an empty box", () => {
    expect(normaliseReferralCode("   ")).toBe("");
  });
});

describe("referralCodeFormatProblem", () => {
  it("accepts letters, numbers and hyphens", () => {
    expect(referralCodeFormatProblem("HTU-OMAR26")).toBeNull();
  });

  it("refuses codes that are too short, too long or have other characters", () => {
    expect(referralCodeFormatProblem("AB")).not.toBeNull();
    expect(referralCodeFormatProblem("A".repeat(21))).not.toBeNull();
    expect(referralCodeFormatProblem("OMAR_1")).not.toBeNull();
  });
});

describe("suggestReferralCode", () => {
  it("uses the first name and three characters from the unambiguous alphabet", () => {
    expect(suggestReferralCode("Omar Khaled", () => 0)).toBe("OMAR222");
    expect(suggestReferralCode("omar", () => 0.999)).toMatch(/^OMAR[2-9A-HJKMNP-Z]{3}$/);
  });

  it("falls back to MMRC when the name has no usable letters", () => {
    expect(suggestReferralCode("عمر", () => 0)).toBe("MMRC222");
  });

  it("always makes a code that passes the format check", () => {
    for (const name of ["Omar", "Lina Haddad", "X", "Abdulrahmanxyz", ""]) {
      expect(referralCodeFormatProblem(suggestReferralCode(name))).toBeNull();
    }
  });
});

describe("validateAmbassador", () => {
  it("needs a name, and allows an empty code", () => {
    expect(validateAmbassador({ name: "", university: "", code: "" }).name).toBeDefined();
    expect(validateAmbassador({ name: "Omar", university: "", code: "" })).toEqual({});
  });

  it("checks a typed code", () => {
    expect(validateAmbassador({ name: "Omar", university: "", code: "A B" }).code).toBeDefined();
  });
});

describe("referralCodeError", () => {
  it("is fine with an empty box", () => {
    expect(referralCodeError("", null)).toBeNull();
  });

  it("refuses unknown and paused codes, accepts active ones", () => {
    expect(referralCodeError("NOPE", null)).toMatch(/don't recognise/);
    expect(referralCodeError("OMAR222", { status: "PAUSED" })).toMatch(/isn't active/);
    expect(referralCodeError("OMAR222", { status: "ACTIVE" })).toBeNull();
  });
});

describe("isAmbassadorStatus", () => {
  it("knows the two statuses", () => {
    expect(isAmbassadorStatus("ACTIVE")).toBe(true);
    expect(isAmbassadorStatus("PAUSED")).toBe(true);
    expect(isAmbassadorStatus("DELETED")).toBe(false);
  });
});
