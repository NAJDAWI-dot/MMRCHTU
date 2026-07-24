import { describe, expect, it } from "vitest";
import { validateRegistration, hasFieldErrors, type TeamMemberInput } from "@/lib/registration";

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

describe("validateRegistration", () => {
  it("accepts a valid registration", () => {
    const errors = validateRegistration({
      teamName: "Maze Runners",
      submitterEmail: "ada@example.com",
      memberCount: 1,
      technicalExperience: "Built line-following robots for two years.",
      motivation: "Excited to build a maze-solver.",
      members: [validMember],
    });
    expect(hasFieldErrors(errors)).toBe(false);
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
