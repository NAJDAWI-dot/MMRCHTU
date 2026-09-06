import { describe, expect, it } from "vitest";
import {
  COMMITTEE_RANKS,
  buildRoster,
  initials,
  isCommitteeRank,
  isLeadership,
  parseCommitteeRank,
  portraitStorageKey,
  rankOrder,
  rosterSize,
} from "@/lib/roster";

const dept = (id: string, name: string, sortOrder = 0) => ({ id, name, sortOrder });
const person = (
  id: string,
  rank: string,
  departmentId: string | null = null,
  sortOrder = 0,
  name = id,
) => ({ id, name, rank, departmentId, sortOrder });

describe("rank", () => {
  it("recognises only the four ranks", () => {
    for (const rank of COMMITTEE_RANKS) expect(isCommitteeRank(rank)).toBe(true);
    expect(isCommitteeRank("PRESIDENT")).toBe(false);
    expect(isCommitteeRank(null)).toBe(false);
  });

  it("falls back to Member for anything it does not know", () => {
    expect(parseCommitteeRank("CHAIR")).toBe("CHAIR");
    expect(parseCommitteeRank("nonsense")).toBe("MEMBER");
  });

  it("orders the hierarchy from the top down", () => {
    expect(rankOrder("CHAIR")).toBeLessThan(rankOrder("CO_CHAIR"));
    expect(rankOrder("CO_CHAIR")).toBeLessThan(rankOrder("DEPARTMENT_HEAD"));
    expect(rankOrder("DEPARTMENT_HEAD")).toBeLessThan(rankOrder("MEMBER"));
  });

  it("sorts an unknown rank last, so it can never outrank the chair", () => {
    expect(rankOrder("???")).toBeGreaterThan(rankOrder("MEMBER"));
  });

  it("counts only the chair and co-chair as leadership", () => {
    expect(isLeadership("CHAIR")).toBe(true);
    expect(isLeadership("CO_CHAIR")).toBe(true);
    expect(isLeadership("DEPARTMENT_HEAD")).toBe(false);
    expect(isLeadership("MEMBER")).toBe(false);
  });
});

describe("buildRoster", () => {
  const departments = [dept("d1", "Logistics", 1), dept("d2", "Design", 0)];

  it("puts the chair above the co-chair, both above the departments", () => {
    const roster = buildRoster(departments, [
      person("co", "CO_CHAIR"),
      person("chair", "CHAIR"),
    ]);
    expect(roster.leadership.map((m) => m.id)).toEqual(["chair", "co"]);
  });

  it("orders departments by their own sort order, not the order given", () => {
    const roster = buildRoster(departments, []);
    expect(roster.groups.map((g) => g.department.name)).toEqual(["Design", "Logistics"]);
  });

  it("separates a department's head from its members", () => {
    const roster = buildRoster(departments, [
      person("m1", "MEMBER", "d1", 1),
      person("head", "DEPARTMENT_HEAD", "d1"),
      person("m2", "MEMBER", "d1", 0),
    ]);
    const logistics = roster.groups.find((g) => g.department.id === "d1")!;
    expect(logistics.heads.map((m) => m.id)).toEqual(["head"]);
    expect(logistics.members.map((m) => m.id)).toEqual(["m2", "m1"]);
  });

  it("keeps two co-heads rather than picking one", () => {
    const roster = buildRoster(departments, [
      person("h1", "DEPARTMENT_HEAD", "d1", 0),
      person("h2", "DEPARTMENT_HEAD", "d1", 1),
    ]);
    expect(roster.groups.find((g) => g.department.id === "d1")!.heads).toHaveLength(2);
  });

  it("leaves a chair at the top even if they also lead a department", () => {
    // The admin form allows both, because people do both. Appearing twice
    // would be worse than appearing once in the right place.
    const roster = buildRoster(departments, [person("chair", "CHAIR", "d1")]);
    expect(roster.leadership.map((m) => m.id)).toEqual(["chair"]);
    expect(roster.groups.find((g) => g.department.id === "d1")!.members).toEqual([]);
  });

  it("never loses somebody whose department was deleted", () => {
    const roster = buildRoster(departments, [person("orphan", "MEMBER", "gone")]);
    expect(roster.unassigned.map((m) => m.id)).toEqual(["orphan"]);
  });

  it("collects members with no department at all", () => {
    const roster = buildRoster(departments, [person("floating", "MEMBER", null)]);
    expect(roster.unassigned.map((m) => m.id)).toEqual(["floating"]);
  });

  it("keeps empty departments, because the admin page has to show them", () => {
    const roster = buildRoster(departments, []);
    expect(roster.groups).toHaveLength(2);
    expect(roster.groups.every((g) => g.heads.length === 0 && g.members.length === 0)).toBe(true);
  });

  it("breaks ties alphabetically once the admin order runs out", () => {
    const roster = buildRoster(departments, [
      person("b", "MEMBER", "d1", 0, "Zara"),
      person("a", "MEMBER", "d1", 0, "Adam"),
    ]);
    expect(roster.groups.find((g) => g.department.id === "d1")!.members.map((m) => m.name)).toEqual([
      "Adam",
      "Zara",
    ]);
  });

  it("counts everybody exactly once", () => {
    const roster = buildRoster(departments, [
      person("chair", "CHAIR"),
      person("head", "DEPARTMENT_HEAD", "d1"),
      person("m", "MEMBER", "d2"),
      person("orphan", "MEMBER", null),
    ]);
    expect(rosterSize(roster)).toBe(4);
  });
});

describe("initials", () => {
  it("takes the first and last word", () => {
    expect(initials("Hatem Al Muwadea")).toBe("HM");
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("handles a single name", () => {
    expect(initials("Cheddar")).toBe("C");
  });

  it("works on a non-Latin name", () => {
    expect(initials("حاتم المواضعة")).toBe("حا");
  });

  it("always returns something, so the circle is never empty", () => {
    expect(initials("   ")).toBe("?");
    expect(initials("!!!")).toBe("?");
  });
});

describe("portraitStorageKey", () => {
  it("takes its extension from the verified type, never the filename", () => {
    expect(portraitStorageKey("Ada Lovelace", "image/png", "abc")).toBe("team/ada-lovelace-abc.png");
    expect(portraitStorageKey("Ada Lovelace", "image/jpeg", "abc")).toBe("team/ada-lovelace-abc.jpg");
  });

  it("cannot be steered out of its folder", () => {
    // The traversal fixture avoids a well-known system path on purpose: secret
    // scanners flag strings like that on sight, and a test input is a poor
    // reason to make somebody triage a false positive every time they push.
    const key = portraitStorageKey("../../some/other/folder", "image/png", "abc");
    expect(key.startsWith("team/")).toBe(true);
    expect(key).not.toContain("..");
  });

  it("still produces a key for a name that slugifies to nothing", () => {
    expect(portraitStorageKey("حاتم", "image/webp", "abc")).toBe("team/member-abc.webp");
  });
});
