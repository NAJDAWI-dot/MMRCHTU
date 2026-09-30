import { describe, expect, it } from "vitest";
import { MAX_MEMBERS, planMembers, prunePresent, readTeamEdit, validateTeamEdit, type MemberEdit } from "@/lib/team-edit";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const member = (over: Partial<MemberEdit> = {}): MemberEdit => ({
  id: null,
  firstName: "Lina",
  lastName: "Haddad",
  email: "lina@example.com",
  whatsapp: "",
  university: "",
  major: "",
  ieeeStatus: "NON_MEMBER",
  ieeeMembershipId: "Non-Member",
  ...over,
});

const team = { teamName: "Maze Runners", submitterEmail: "lead@example.com", technicalExperience: "", motivation: "" };

describe("readTeamEdit", () => {
  it("reads members in index order, skipping gaps left by removed rows", () => {
    const edit = readTeamEdit(
      form({
        teamName: "  Maze Runners ",
        submitterEmail: "lead@example.com",
        "m.2.id": "",
        "m.2.firstName": "Omar",
        "m.0.id": "a",
        "m.0.firstName": "Lina",
      }),
    );
    expect(edit.teamName).toBe("Maze Runners");
    expect(edit.members.map((m) => [m.id, m.firstName])).toEqual([
      ["a", "Lina"],
      [null, "Omar"],
    ]);
  });

  it("falls back to non-member for a missing or unknown IEEE status", () => {
    const edit = readTeamEdit(form({ "m.0.firstName": "Lina", "m.0.ieeeStatus": "ADMIN" }));
    expect(edit.members[0]?.ieeeStatus).toBe("NON_MEMBER");
    expect(edit.members[0]?.ieeeMembershipId).toBe("Non-Member");
  });

  it("does not read an unbounded number of rows", () => {
    const fields: Record<string, string> = {};
    for (let i = 0; i < 50; i++) fields[`m.${i}.firstName`] = `M${i}`;
    expect(readTeamEdit(form(fields)).members.length).toBe(MAX_MEMBERS + 1);
  });
});

describe("validateTeamEdit", () => {
  it("accepts a member with only a name and an email", () => {
    expect(validateTeamEdit({ ...team, members: [member()] })).toEqual({});
  });

  it("names the field that is wrong, per member", () => {
    const errors = validateTeamEdit({ ...team, members: [member(), member({ email: "nope", lastName: "" })] });
    expect(Object.keys(errors).sort()).toEqual(["m.1.email", "m.1.lastName"]);
  });

  it("refuses an empty team and one over the size limit", () => {
    expect(validateTeamEdit({ ...team, members: [] }).members).toMatch(/at least one/);
    const tooMany = Array.from({ length: MAX_MEMBERS + 1 }, () => member());
    expect(validateTeamEdit({ ...team, members: tooMany }).members).toMatch(/at most 3/);
  });

  it("refuses the same stored member twice", () => {
    expect(validateTeamEdit({ ...team, members: [member({ id: "a" }), member({ id: "a" })] }).members).toBeTruthy();
  });

  it("checks the team name and contact email", () => {
    const errors = validateTeamEdit({ ...team, teamName: "X", submitterEmail: "x", members: [member()] });
    expect(errors.teamName).toBeTruthy();
    expect(errors.submitterEmail).toBeTruthy();
  });
});

describe("planMembers", () => {
  it("removes stored members left out, keeps and renumbers the rest, and adds new ones", () => {
    const plan = planMembers(["a", "b", "c"], [member({ id: "c" }), member({ firstName: "New" }), member({ id: "a" })]);
    expect(plan?.remove).toEqual(["b"]);
    expect(plan?.update.map((u) => [u.id, u.order])).toEqual([
      ["c", 1],
      ["a", 3],
    ]);
    expect(plan?.create.map((c) => [c.data.firstName, c.order])).toEqual([["New", 2]]);
  });

  it("refuses a member id that belongs to another team", () => {
    expect(planMembers(["a"], [member({ id: "someone-else" })])).toBeNull();
  });
});

describe("prunePresent", () => {
  it("drops removed members from the desk's list", () => {
    expect(prunePresent("a,b,c", ["b"])).toBe("a,c");
  });

  it("leaves an empty list (everyone) and an untouched list alone", () => {
    expect(prunePresent("", ["b"])).toBe("");
    expect(prunePresent("a,b", [])).toBe("a,b");
  });
});
