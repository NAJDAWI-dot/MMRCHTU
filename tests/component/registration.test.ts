import { describe, expect, it } from "vitest";
import { validateRegistration } from "@/lib/registration";

describe("validateRegistration", () => {
  it("accepts a valid registration", () => {
    const errors = validateRegistration({
      teamName: "Maze Runners",
      contactName: "Ada Lovelace",
      email: "ada@example.com",
      memberCount: 3,
    });
    expect(errors).toEqual({});
  });

  it("flags missing and invalid fields", () => {
    const errors = validateRegistration({
      teamName: "A",
      contactName: "",
      email: "not-an-email",
      memberCount: 0,
    });
    expect(errors.teamName).toBeDefined();
    expect(errors.contactName).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.memberCount).toBeDefined();
  });

  it("rejects team sizes outside 1-10", () => {
    const tooMany = validateRegistration({
      teamName: "Maze Runners",
      contactName: "Ada",
      email: "ada@example.com",
      memberCount: 11,
    });
    expect(tooMany.memberCount).toBeDefined();
  });
});
