import { describe, expect, it } from "vitest";
import {
  REGISTRATION_STATUSES,
  isRegistrationStatus,
  parseRegistrationStatus,
} from "@/lib/registration-status";

describe("REGISTRATION_STATUSES", () => {
  it("lists each status once", () => {
    expect(new Set(REGISTRATION_STATUSES).size).toBe(REGISTRATION_STATUSES.length);
  });

  it("still contains the four the admin dropdown has always offered", () => {
    expect([...REGISTRATION_STATUSES]).toEqual([
      "PENDING",
      "CONFIRMED",
      "WAITLISTED",
      "CANCELLED",
    ]);
  });
});

describe("isRegistrationStatus", () => {
  it("accepts every listed status", () => {
    for (const status of REGISTRATION_STATUSES) {
      expect(isRegistrationStatus(status)).toBe(true);
    }
  });

  it("rejects anything else, including near-misses and other status vocabularies", () => {
    // PaymentStatus is a separate axis on purpose; leaking one into the other
    // is exactly the confusion the two-column split exists to prevent.
    expect(isRegistrationStatus("VERIFIED")).toBe(false);
    expect(isRegistrationStatus("confirmed")).toBe(false);
    expect(isRegistrationStatus("PENDING ")).toBe(false);
    expect(isRegistrationStatus("")).toBe(false);
  });

  it("rejects non-strings rather than coercing them", () => {
    expect(isRegistrationStatus(null)).toBe(false);
    expect(isRegistrationStatus(undefined)).toBe(false);
    expect(isRegistrationStatus(0)).toBe(false);
    expect(isRegistrationStatus({})).toBe(false);
  });
});

describe("parseRegistrationStatus", () => {
  it("returns the status when it is one", () => {
    expect(parseRegistrationStatus("CONFIRMED")).toBe("CONFIRMED");
  });

  it("returns null rather than falling back to a default", () => {
    // A silent fallback would turn a bad request into a state change nobody
    // asked for — "CONFIRMED became PENDING because the form posted junk".
    expect(parseRegistrationStatus("SOMETHING_ELSE")).toBeNull();
    expect(parseRegistrationStatus(null)).toBeNull();
  });

  it("refuses a value that merely contains a real status", () => {
    expect(parseRegistrationStatus("NOT_CONFIRMED")).toBeNull();
  });
});
