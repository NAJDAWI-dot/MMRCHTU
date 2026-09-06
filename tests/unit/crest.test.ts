import { describe, expect, it } from "vitest";
import {
  CREST_GRID,
  crestFor,
  crestSeed,
  hasCrest,
  normaliseCrestName,
} from "@/lib/crest";
import { descentPath, descentProgress } from "@/lib/descent";

/**
 * The crest's whole promise is that it is *theirs* — the same every time they
 * come back, and not the same as the team next to them. Both halves of that
 * are properties of the hash, so both are pinned here.
 */
describe("normaliseCrestName", () => {
  it("treats case and spacing as the same team", () => {
    const forms = ["Maze Runners", "maze runners", "  MAZE   RUNNERS  "];
    const seeds = new Set(forms.map(normaliseCrestName));
    expect(seeds.size).toBe(1);
  });
});

describe("crestSeed", () => {
  it("is stable for the same name", () => {
    expect(crestSeed("Maze Runners")).toBe(crestSeed("Maze Runners"));
  });

  it("ignores case and stray whitespace", () => {
    expect(crestSeed("  maze   runners ")).toBe(crestSeed("Maze Runners"));
  });

  it("separates names that differ by one character", () => {
    // The case a sum-of-characters hash gets wrong, and the one that matters:
    // two teams from the same lab picking near-identical names.
    expect(crestSeed("Maze Runners")).not.toBe(crestSeed("Maze Runner"));
    expect(crestSeed("Team A")).not.toBe(crestSeed("Team B"));
  });

  it("spreads a realistic field of names without collisions", () => {
    const names = [
      "Maze Runners", "Cheese Seekers", "Byte Mice", "Circuit Squad", "Whisker",
      "HTU Micromouse", "Team Alpha", "Team Beta", "Nibble", "Flood Fill",
      "The Mousetrap", "Silicon Tails", "Wall Huggers", "Fast Cheddar", "RAS One",
    ];
    expect(new Set(names.map(crestSeed)).size).toBe(names.length);
  });

  it("survives a name with no Latin characters", () => {
    expect(crestSeed("فريق الفأر")).toBeGreaterThan(0);
    expect(crestSeed("فريق الفأر")).toBe(crestSeed("فريق الفأر"));
  });
});

describe("hasCrest", () => {
  it("waits for something worth hashing", () => {
    expect(hasCrest("")).toBe(false);
    expect(hasCrest(" ")).toBe(false);
    expect(hasCrest("M")).toBe(false);
    expect(hasCrest("Mo")).toBe(true);
  });
});

describe("crestFor", () => {
  it("gives nothing back until the name is long enough", () => {
    expect(crestFor("M")).toBeNull();
  });

  it("builds a real maze of the crest size", () => {
    const crest = crestFor("Maze Runners")!;
    expect(crest.size).toBe(CREST_GRID);
    expect(crest.walls.length).toBeGreaterThan(0);
    expect(crest.routes[0]!.solution).toMatch(/^M\d/);
  });

  it("returns the same crest for the same team, every time", () => {
    expect(JSON.stringify(crestFor("Cheese Seekers"))).toBe(
      JSON.stringify(crestFor("cheese seekers")),
    );
  });

  it("returns a different crest for a different team", () => {
    expect(JSON.stringify(crestFor("Cheese Seekers"))).not.toBe(
      JSON.stringify(crestFor("Maze Runners")),
    );
  });
});

describe("descentPath", () => {
  it("draws only straight runs, like the maze routes do", () => {
    // No curves: the corridor has to read as a corridor, not a squiggle.
    expect(descentPath(6, 100, 1000)).toMatch(/^M [\d.]+ 0( [VH] [\d.]+)+$/);
  });

  it("is the same corridor every time, so the server and browser agree", () => {
    expect(descentPath(6, 100, 1000)).toBe(descentPath(6, 100, 1000));
  });

  it("reaches the bottom of the box", () => {
    expect(descentPath(5, 100, 900).endsWith("V 900.0")).toBe(true);
  });

  it("never turns back into the lane it is already in", () => {
    const path = descentPath(12, 100, 2000);
    const lanes = [...path.matchAll(/H ([\d.]+)/g)].map((m) => m[1]);
    for (let i = 1; i < lanes.length; i += 1) {
      expect(lanes[i]).not.toBe(lanes[i - 1]);
    }
  });

  it("returns nothing for a box with no room in it", () => {
    expect(descentPath(0, 100, 100)).toBe("");
    expect(descentPath(4, 0, 100)).toBe("");
  });
});

describe("descentProgress", () => {
  it("runs from 0 at the top to 1 at the bottom", () => {
    expect(descentProgress(0, 3000, 1000)).toBe(0);
    expect(descentProgress(2000, 3000, 1000)).toBe(1);
    expect(descentProgress(1000, 3000, 1000)).toBeCloseTo(0.5);
  });

  it("measures against the scrollable distance, not the page height", () => {
    // Dividing by the document height would leave the corridor a whole screen
    // short of finishing on every page, however far you scrolled.
    expect(descentProgress(2000, 3000, 1000)).toBe(1);
  });

  it("treats a page with nothing to scroll as complete", () => {
    expect(descentProgress(0, 800, 1000)).toBe(1);
  });

  it("clamps rubber-band scrolling at both ends", () => {
    expect(descentProgress(-120, 3000, 1000)).toBe(0);
    expect(descentProgress(99_999, 3000, 1000)).toBe(1);
  });
});
