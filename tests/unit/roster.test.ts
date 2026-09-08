import { describe, expect, it } from "vitest";
import {
  COMMITTEE_RANKS,
  COMMITTEE_STAGES,
  buildRoster,
  initials,
  isCommitteeRank,
  isLeadership,
  parseCommitteeRank,
  portraitStorageKey,
  rankOrder,
  rosterSize,
  stageFor,
  stageSeed,
  stageStorageKey,
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

describe("stageStorageKey", () => {
  it("keeps stages out of the folder the faces are in", () => {
    expect(stageStorageKey("Ada Lovelace", "image/png", "abc")).toBe(
      "team/stages/ada-lovelace-abc.png",
    );
  });

  it("cannot be steered out of its folder", () => {
    const key = stageStorageKey("../../some/other/folder", "image/jpeg", "abc");
    expect(key.startsWith("team/stages/")).toBe(true);
    expect(key).not.toContain("..");
  });

  it("still produces a key for a name that slugifies to nothing", () => {
    expect(stageStorageKey("حاتم", "image/webp", "abc")).toBe("team/stages/member-abc.webp");
  });
});

/**
 * The stage somebody is lit on when no picture has been uploaded for them.
 *
 * Three properties, and each of them is load-bearing somewhere the compiler
 * cannot see. It has to be stable, because an unstable pick would differ
 * between the server render and the browser's. It has to spread, because a
 * fallback that lights the whole committee the same way is not a fallback worth
 * having. And every colour has to be six hex digits, because the dialog builds
 * its glow by concatenating an alpha pair onto the end of one.
 */
describe("the stage a member is given", () => {
  const ids = Array.from({ length: 60 }, (_, index) => `cm_committee_member_${index}`);

  it("is the same one every time, so it cannot change under them mid-visit", () => {
    expect(stageSeed("ckabc123")).toBe(stageSeed("ckabc123"));
    expect(stageFor("ckabc123")).toBe(stageFor("ckabc123"));
  });

  it("always lands on a stage that exists", () => {
    for (const id of [...ids, "", "x", "٣", "a".repeat(500)]) {
      const seed = stageSeed(id);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(COMMITTEE_STAGES.length);
      expect(stageFor(id)).toBeDefined();
    }
  });

  it("spreads across the committee rather than lighting everybody alike", () => {
    const used = new Set(ids.map(stageSeed));
    expect(used.size).toBe(COMMITTEE_STAGES.length);
  });

  it("is written as six hex digits, which the dialog appends its alpha to", () => {
    for (const stage of COMMITTEE_STAGES) {
      expect(stage.glow).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(stage.ground).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("is grounded dark enough that white type reads on it", () => {
    for (const stage of COMMITTEE_STAGES) {
      expect(contrastWithWhite(stage.ground)).toBeGreaterThan(12);
    }
  });

  it("is lit dark enough that white type reads on the pool of light too", () => {
    // The assertion the light scrim in globals.css leans on. A composed stage
    // gets barely any scrim, precisely so its colour reads as a spotlight
    // rather than as grey — which is only safe while the brightest thing on it,
    // the glow at full strength, still clears AA for the type over it.
    for (const stage of COMMITTEE_STAGES) {
      expect(contrastWithWhite(stage.glow)).toBeGreaterThan(4.5);
    }
  });
});

function contrastWithWhite(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * channel(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * channel(parseInt(hex.slice(5, 7), 16));

  return 1.05 / (luminance + 0.05);
}
