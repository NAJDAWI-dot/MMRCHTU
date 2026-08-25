import { describe, expect, it } from "vitest";
import {
  feeTierForTeam,
  validateRegistration,
  hasFieldErrors,
  type TeamMemberInput,
} from "@/lib/registration";

const validMember: TeamMemberInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  whatsapp: "+962700000000",
  university: "The University of Jordan (UJ)",
  major: "Computer Engineering",
  ieeeStatus: "NON_MEMBER",
  ieeeMembershipId: "Non-Member",
};

describe("feeTierForTeam", () => {
  it("prices the team from the leader, not from the other members", () => {
    const leader = { ieeeStatus: "IEEE_RAS_MEMBER" } as const;
    const others = [{ ieeeStatus: "NON_MEMBER" } as const, { ieeeStatus: "NON_MEMBER" } as const];
    expect(feeTierForTeam([leader, ...others])).toBe("IEEE_RAS_MEMBER");
  });

  it("falls back to the full price when there is no usable leader status", () => {
    // Charging the lowest rate on missing data would make omitting the field
    // the cheapest way to register.
    expect(feeTierForTeam([])).toBe("NON_MEMBER");
    expect(feeTierForTeam([{ ieeeStatus: "" as TeamMemberInput["ieeeStatus"] }])).toBe("NON_MEMBER");
  });
});

describe("validateRegistration", () => {
  it("accepts a valid registration", () => {
    const errors = validateRegistration({
      teamName: "Maze Runners",
      submitterEmail: "ada@example.com",
      memberCount: 1,
      technicalExperience: "Built line-following robots for two years.",
      motivation: "Excited to build a maze-solver.",
      consentAccepted: true,
      members: [validMember],
    });
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it("refuses to register a team that has not accepted the terms", () => {
    // The consent record is what shows a team agreed before money changed
    // hands, so it cannot be inferred from them simply submitting the form.
    const errors = validateRegistration({
      teamName: "Maze Runners",
      submitterEmail: "ada@example.com",
      memberCount: 1,
      technicalExperience: "Some experience.",
      motivation: "Motivated.",
      consentAccepted: false,
      members: [validMember],
    });
    expect(errors.consentAccepted).toBeDefined();
    expect(hasFieldErrors(errors)).toBe(true);
  });

  it("flags missing and invalid team-level fields", () => {
    const errors = validateRegistration({
      teamName: "A",
      submitterEmail: "not-an-email",
      memberCount: 0,
      technicalExperience: "",
      motivation: "",
      members: [],
    });
    expect(errors.teamName).toBeDefined();
    expect(errors.submitterEmail).toBeDefined();
    expect(errors.memberCount).toBeDefined();
    expect(errors.technicalExperience).toBeDefined();
    expect(errors.motivation).toBeDefined();
  });

  it("rejects team sizes outside 1-3", () => {
    const tooMany = validateRegistration({
      teamName: "Maze Runners",
      submitterEmail: "ada@example.com",
      memberCount: 4,
      technicalExperience: "Some experience.",
      motivation: "Motivated.",
      members: [validMember, validMember, validMember, validMember],
    });
    expect(tooMany.memberCount).toBeDefined();
  });

  it("flags missing member fields", () => {
    const errors = validateRegistration({
      teamName: "Maze Runners",
      submitterEmail: "ada@example.com",
      memberCount: 1,
      technicalExperience: "Some experience.",
      motivation: "Motivated.",
      members: [{}],
    });
    expect(errors.members?.[0]?.firstName).toBeDefined();
    expect(errors.members?.[0]?.email).toBeDefined();
  });
});
