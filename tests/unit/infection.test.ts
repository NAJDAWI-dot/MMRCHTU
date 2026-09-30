import { describe, expect, it } from "vitest";
import vm from "node:vm";
import {
  FULL_STAGE,
  contrast,
  infectionCss,
  infectionExempt,
  infectionPrePaintScript,
  infectionStage,
  mix,
  nextInfectionChange,
  readPreview,
  swatchAt,
  type Rgb,
} from "@/lib/infection";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 4, 6, 0);

describe("infectionStage", () => {
  it("follows the whole days on the countdown", () => {
    expect(infectionStage(START, START - 7 * DAY)).toBe(0);
    expect(infectionStage(START, START - 6 * DAY)).toBe(0);
    expect(infectionStage(START, START - 6 * DAY + 1)).toBe(1);
    expect(infectionStage(START, START - 5 * DAY)).toBe(1);
    expect(infectionStage(START, START - 5 * DAY + 1)).toBe(2);
    expect(infectionStage(START, START - 4 * DAY + 1)).toBe(3);
    expect(infectionStage(START, START - 3 * DAY + 1)).toBe(4);
    expect(infectionStage(START, START - 2 * DAY + 1)).toBe(5);
    expect(infectionStage(START, START - DAY + 1)).toBe(FULL_STAGE);
  });

  it("is whole through the first day and clean after it", () => {
    expect(infectionStage(START, START)).toBe(FULL_STAGE);
    expect(infectionStage(START, START + DAY - 1)).toBe(FULL_STAGE);
    expect(infectionStage(START, START + DAY)).toBe(0);
  });

  it("does nothing without a date or when switched off", () => {
    expect(infectionStage(null, START)).toBe(0);
    expect(infectionStage(START, START - DAY, false)).toBe(0);
    expect(infectionStage(new Date("nonsense"), START)).toBe(0);
  });
});

describe("nextInfectionChange", () => {
  it("points at the next time the counter drops a day", () => {
    expect(nextInfectionChange(START, START - 5 * DAY - 1000)).toBe(1001);
    expect(nextInfectionChange(START, START - 3 * DAY)).toBe(1);
    expect(nextInfectionChange(START, START - 9 * DAY)).toBe(3 * DAY + 1);
    expect(nextInfectionChange(START, START - 1000)).toBe(DAY + 1000);
    expect(nextInfectionChange(START, START + 1000)).toBe(DAY - 1000);
    expect(nextInfectionChange(START, START + DAY)).toBeNull();
    expect(nextInfectionChange(null, START)).toBeNull();
  });

  it("lands on a moment where the stage really changes", () => {
    for (let now = START - 8 * DAY + 12345; now < START + DAY; now += DAY / 7) {
      const wait = nextInfectionChange(START, now);
      if (wait === null) continue;
      expect(infectionStage(START, now + wait)).not.toBe(infectionStage(START, now + wait - 1));
    }
  });
});

describe("readPreview", () => {
  it("reads a stage, the clean site or the way back to the real date", () => {
    expect(readPreview("3")).toBe(3);
    expect(readPreview("0")).toBe(0);
    expect(readPreview("9")).toBe(FULL_STAGE);
    expect(readPreview("live")).toBe("live");
    expect(readPreview("off")).toBe("live");
    expect(readPreview("two")).toBeUndefined();
    expect(readPreview(null)).toBeUndefined();
  });
});

describe("infectionExempt", () => {
  it("leaves the admin area and the day site alone", () => {
    expect(infectionExempt("/admin")).toBe(true);
    expect(infectionExempt("/admin/competition-day")).toBe(true);
    expect(infectionExempt("/day")).toBe(true);
    expect(infectionExempt("/day/standings")).toBe(true);
    expect(infectionExempt("/")).toBe(false);
    expect(infectionExempt("/daylight")).toBe(false);
    expect(infectionExempt("/rules")).toBe(false);
  });
});

/** Runs the pre-paint script in a sandbox and returns the stage it set. */
function runScript(options: { eventMs: number | null; enabled?: boolean; now: number; path?: string; search?: string; stored?: string }) {
  const attributes: Record<string, string> = {};
  const session = new Map<string, string>();
  if (options.stored !== undefined) session.set("mmrc26-infection-preview", options.stored);
  const context = {
    document: { documentElement: { setAttribute: (key: string, value: string) => (attributes[key] = value) } },
    location: { pathname: options.path ?? "/", search: options.search ?? "" },
    URLSearchParams,
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
      removeItem: (key: string) => session.delete(key),
    },
    Date: { now: () => options.now },
    Math,
    String,
  };
  vm.runInNewContext(infectionPrePaintScript(options.eventMs, options.enabled ?? true), context);
  return { stage: attributes["data-infect"] ? Number(attributes["data-infect"]) : 0, stored: session.get("mmrc26-infection-preview") };
}

describe("infectionPrePaintScript", () => {
  it("agrees with infectionStage at every hour of the week around the start", () => {
    for (let now = START - 8 * DAY; now <= START + 2 * DAY; now += 60 * 60 * 1000) {
      expect(runScript({ eventMs: START, now }).stage).toBe(infectionStage(START, now));
    }
  });

  it("stays out of the admin area and the day site", () => {
    expect(runScript({ eventMs: START, now: START - 1000, path: "/admin/competition-day" }).stage).toBe(0);
    expect(runScript({ eventMs: START, now: START - 1000, path: "/day/standings" }).stage).toBe(0);
  });

  it("respects the switch and a missing date", () => {
    expect(runScript({ eventMs: START, now: START - 1000, enabled: false }).stage).toBe(0);
    expect(runScript({ eventMs: null, now: START - 1000 }).stage).toBe(0);
  });

  it("shows and remembers a preview, and lets it go", () => {
    const preview = runScript({ eventMs: null, now: START, search: "?infection=4" });
    expect(preview).toEqual({ stage: 4, stored: "4" });
    expect(runScript({ eventMs: null, now: START, stored: "4" }).stage).toBe(4);
    expect(runScript({ eventMs: START, now: START - 1000, stored: "0" }).stage).toBe(0);
    const back = runScript({ eventMs: START, now: START - 3 * DAY + 1, search: "?infection=live", stored: "2" });
    expect(back).toEqual({ stage: 4, stored: undefined });
  });
});

describe("colours", () => {
  it("mixes from one end to the other", () => {
    expect(mix([10, 20, 30], [200, 100, 50], 0)).toEqual([10, 20, 30]);
    expect(mix([10, 20, 30], [200, 100, 50], 1)).toEqual([200, 100, 50]);
  });

  it("starts where the site is now", () => {
    expect(swatchAt("--rgb-ras-purple", "light", 0)).toEqual([95, 33, 103]);
    expect(swatchAt("--color-bg", "dark", 0)).toEqual([23, 17, 26]);
  });

  // Text that is read, against what it is read on, at every stage in both
  // themes. The site already clears AA with these pairs; so must every day of
  // the week in between.
  const light: [string, string][] = [
    ["--color-fg", "--color-bg"],
    ["--color-fg", "--color-surface"],
    ["--color-accent-rgb", "--color-bg"],
    ["--color-accent-rgb", "--color-surface"],
    ["--rgb-ras-purple", "--color-bg"],
    ["--rgb-ras-purple", "--color-surface"],
    ["--rgb-ras-gray", "--color-bg"],
    ["--rgb-ras-gray", "--color-surface"],
    ["--rgb-white", "--rgb-ras-purple"],
    ["--rgb-white", "--rgb-ras-crimson"],
    ["--rgb-white", "--rgb-mood-rose"],
    ["--rgb-white", "--rgb-ras-gray"],
  ];
  const dark: [string, string][] = [
    ["--color-fg", "--color-bg"],
    ["--color-fg", "--color-surface"],
    ["--color-accent-rgb", "--color-bg"],
    ["--color-accent-rgb", "--color-surface"],
    ["--rgb-white", "--color-bg"],
    ["--rgb-white", "--color-surface"],
    ["--rgb-white", "--rgb-ras-purple"],
    ["--rgb-white", "--rgb-ras-crimson"],
    ["--rgb-white", "--rgb-mood-rose"],
  ];

  for (const [theme, pairs] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`keeps every text pair at 4.5:1 or better in ${theme}, at every stage`, () => {
      const failures: string[] = [];
      for (let stage = 0; stage <= FULL_STAGE; stage++) {
        for (const [text, ground] of pairs) {
          const ratio = contrast(swatchAt(text, theme, stage) as Rgb, swatchAt(ground, theme, stage) as Rgb);
          if (ratio < 4.5) failures.push(`stage ${stage}: ${text} on ${ground} is ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it("writes a rule for every stage in both themes, and gives the rulebook's paper back", () => {
    const css = infectionCss();
    for (let stage = 1; stage <= FULL_STAGE; stage++) {
      expect(css).toContain(`html[data-infect="${stage}"]{`);
      expect(css).toContain(`html.dark[data-infect="${stage}"]{`);
    }
    expect(css).toContain(`html[data-infect] .book-light{`);
    expect(css).toContain("--rgb-ras-purple:32 13 39");
  });
});
