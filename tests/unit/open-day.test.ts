import { describe, expect, it } from "vitest";
import { generateMaze, seededRandom } from "@/lib/maze";
import { crestFor } from "@/lib/crest";
import { DIAGRAM_BRAID, RULES, compareRuns, searchWalk, startCell } from "@/lib/rules";
import {
  CARD_NAME_MAX,
  CREST_CARD,
  EXPLAINER_LENGTH_MS,
  EXPLAINER_TIMELINE,
  TEACHING_RATIO,
  WALL_LIMIT,
  cardName,
  crestCardSvg,
  crestFileName,
  crestNameFontSize,
  escapeXml,
  explainerFrameAt,
  explainerShowsSpeedRun,
  nextOpenDayBoundary,
  openDayClock,
  openDayDateLabel,
  openDayPhase,
  openDayWindow,
  parseMoment,
  teachingMaze,
  teachingRatio,
  teamCountLabel,
  wallSummary,
} from "@/lib/open-day";

const maze = () => generateMaze(RULES.mazeGrid, seededRandom(42), DIAGRAM_BRAID);

describe("searchWalk", () => {
  it("never jumps: every step is to a neighbouring cell", () => {
    // The whole reason this exists rather than a line through searchRun's
    // visited list. A path that teleports across the maze on every backtrack
    // is not a picture of a mouse exploring.
    const walk = searchWalk(maze());
    for (let i = 1; i < walk.length; i++) {
      const previous = walk[i - 1]!;
      const current = walk[i]!;
      const distance = Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
      expect(distance).toBe(1);
    }
  });

  it("starts where the mouse starts and ends on the goal", () => {
    const m = maze();
    const walk = searchWalk(m);
    const start = startCell(m);
    const end = walk[walk.length - 1]!;
    const middle = m.size / 2;

    expect(walk[0]).toEqual(start);
    // The goal room is the 2x2 block at the centre.
    expect([middle - 1, middle]).toContain(end.x);
    expect([middle - 1, middle]).toContain(end.y);
  });

  it("walks back out of dead ends, so it is longer than the cells it found", () => {
    const m = maze();
    const walk = searchWalk(m);
    const distinct = new Set(walk.map((cell) => `${cell.x},${cell.y}`));
    expect(walk.length).toBeGreaterThan(distinct.size);
  });

  it("is the same walk every time for the same maze", () => {
    expect(searchWalk(maze())).toEqual(searchWalk(maze()));
  });
});

describe("the explainer timeline", () => {
  it("runs for twenty seconds", () => {
    expect(EXPLAINER_LENGTH_MS).toBe(20_000);
  });

  it("gives the search run the largest share", () => {
    const search = EXPLAINER_TIMELINE.find((beat) => beat.phase === "search")!;
    const others = EXPLAINER_TIMELINE.filter((beat) => beat.phase !== "search");
    for (const beat of others) expect(search.ms).toBeGreaterThan(beat.ms);
  });

  it("opens on the search run and closes on the pitch", () => {
    expect(explainerFrameAt(0).phase).toBe("search");
    expect(explainerFrameAt(EXPLAINER_LENGTH_MS - 1).phase).toBe("pitch");
  });

  it("moves through all four beats in order", () => {
    const seen: string[] = [];
    for (let t = 0; t < EXPLAINER_LENGTH_MS; t += 100) {
      const { phase } = explainerFrameAt(t);
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    expect(seen).toEqual(["search", "learned", "speed", "pitch"]);
  });

  it("reports progress through the current beat, from 0 to 1", () => {
    const first = EXPLAINER_TIMELINE[0]!;
    expect(explainerFrameAt(0).progress).toBe(0);
    expect(explainerFrameAt(first.ms / 2).progress).toBeCloseTo(0.5, 5);
    expect(explainerFrameAt(first.ms - 1).progress).toBeLessThan(1);
  });

  it("wraps, because it loops all day with nobody to restart it", () => {
    expect(explainerFrameAt(EXPLAINER_LENGTH_MS)).toEqual(explainerFrameAt(0));
    expect(explainerFrameAt(EXPLAINER_LENGTH_MS * 3 + 250)).toEqual(explainerFrameAt(250));
  });

  it("survives a clock that has gone backwards", () => {
    // A tab waking up, not a bug worth crashing the stand over.
    const frame = explainerFrameAt(-500);
    expect(frame.phase).toBe("pitch");
    expect(frame.overall).toBeGreaterThan(0);
    expect(frame.overall).toBeLessThanOrEqual(1);
  });

  it("draws the exploring line first and the fast line second", () => {
    expect(explainerShowsSpeedRun("search")).toBe(false);
    expect(explainerShowsSpeedRun("learned")).toBe(false);
    expect(explainerShowsSpeedRun("speed")).toBe(true);
    expect(explainerShowsSpeedRun("pitch")).toBe(true);
  });
});

describe("the wall of teams", () => {
  it("draws everything while the list is short", () => {
    expect(wallSummary(12)).toEqual({ total: 12, shown: 12, overflow: 0 });
  });

  it("caps what it draws and counts the rest", () => {
    const summary = wallSummary(WALL_LIMIT + 9);
    expect(summary.shown).toBe(WALL_LIMIT);
    expect(summary.overflow).toBe(9);
  });

  it("treats a negative count as nothing rather than as an overflow", () => {
    expect(wallSummary(-3)).toEqual({ total: 0, shown: 0, overflow: 0 });
  });

  it("counts teams in words that read properly at one", () => {
    expect(teamCountLabel(0)).toBe("No teams yet");
    expect(teamCountLabel(1)).toBe("1 team registered so far");
    expect(teamCountLabel(2)).toBe("2 teams registered so far");
  });
});

describe("the crest card", () => {
  it("names the download after the team", () => {
    expect(crestFileName("Maze Mice")).toBe("mmrc26-crest-maze-mice.png");
  });

  it("survives a name a phone could not save", () => {
    expect(crestFileName("فئران/المتاهة")).toBe("mmrc26-crest-team.png");
    expect(crestFileName("  ")).toBe("mmrc26-crest-team.png");
    expect(crestFileName("A!!!B")).toBe("mmrc26-crest-a-b.png");
  });

  it("escapes what goes into the markup", () => {
    expect(escapeXml('Tom & "Jerry" <b>')).toBe("Tom &amp; &quot;Jerry&quot; &lt;b&gt;");
  });

  it("shortens a name too long for the one line it has", () => {
    const long = "A".repeat(CARD_NAME_MAX + 10);
    expect(cardName(long).length).toBe(CARD_NAME_MAX);
    expect(cardName("  Maze   Mice ")).toBe("Maze Mice");
  });

  it("shrinks the type as the name grows", () => {
    expect(crestNameFontSize("Mice")).toBeGreaterThan(crestNameFontSize("The Maze Mice Of HTU"));
  });

  it("is a standalone image, carrying its own colours and size", () => {
    const card = crestCardSvg({ name: "Maze Mice", maze: crestFor("Maze Mice")! });
    expect(card.startsWith("<svg xmlns=")).toBe(true);
    expect(card).toContain(`width="${CREST_CARD.width}"`);
    expect(card).toContain(`height="${CREST_CARD.height}"`);
    expect(card).toContain("Maze Mice");
    expect(card).toContain("mmrchtu.tech");
    // No class attributes anywhere: nothing on this card can inherit a single
    // thing from the page it was made on, because it is downloaded and posted.
    expect(card).not.toContain("class=");
  });

  it("puts a hostile name in as text rather than as markup", () => {
    const name = 'Mice <script>alert("x")</script>';
    const card = crestCardSvg({ name, maze: crestFor(name)! });
    expect(card).not.toContain("<script>");
    expect(card).toContain("&lt;script&gt;");
  });

  it("draws the same maze the site draws for that name", () => {
    const card = crestCardSvg({ name: "Maze Mice", maze: crestFor("Maze Mice")! });
    for (const wall of crestFor("Maze Mice")!.walls) {
      expect(card).toContain(`d="${wall}"`);
    }
  });
});

describe("choosing a maze for the explainer", () => {
  it("measures how much dearer exploring was than running", () => {
    const m = maze();
    const runs = compareRuns(m);
    expect(teachingRatio(m)).toBeCloseTo(runs.search.moves / (runs.speed.length - 1), 5);
  });

  it("returns a maze of the competition's size", () => {
    const chosen = teachingMaze(seededRandom(7));
    expect(chosen.size).toBe(RULES.mazeGrid);
    expect(chosen.cells).toHaveLength(RULES.mazeGrid * RULES.mazeGrid);
  });

  it("takes what it is given when it is only allowed one try", () => {
    expect(teachingMaze(seededRandom(3), 1)).toEqual(
      generateMaze(RULES.mazeGrid, seededRandom(3), DIAGRAM_BRAID),
    );
  });

  it("almost always finds one that makes the point", () => {
    // Deterministic seeds, so this is a fact about the function rather than a
    // coin toss that will one day fail in CI. Roughly 60% of mazes clear the
    // bar on their own, and six tries turn that into a near certainty.
    const cleared = Array.from({ length: 10 }, (_, seed) =>
      teachingRatio(teachingMaze(seededRandom(seed + 1))),
    ).filter((ratio) => ratio >= TEACHING_RATIO);
    expect(cleared.length).toBeGreaterThanOrEqual(9);
  });

  it("still answers when no candidate clears the bar", () => {
    // A rand that hands back the same maze every time: the loop cannot improve
    // on it and must return it rather than spinning or returning nothing.
    const fixed = teachingMaze(() => 0.5, 6);
    expect(fixed.size).toBe(RULES.mazeGrid);
  });
});

describe("the open day window", () => {
  const START = "2026-09-30T10:00:00+03:00";
  const END = "2026-09-30T16:00:00+03:00";
  const env = { OPEN_DAY_STARTS_AT: START, OPEN_DAY_ENDS_AT: END };

  it("takes the dates from the environment", () => {
    const day = openDayWindow(env);
    expect(day.startsAt.toISOString()).toBe("2026-09-30T07:00:00.000Z");
    expect(day.endsAt.toISOString()).toBe("2026-09-30T13:00:00.000Z");
  });

  it("falls back to the dates in the code when nothing is set", () => {
    const day = openDayWindow({});
    expect(day.endsAt.getTime()).toBeGreaterThan(day.startsAt.getTime());
  });

  it("ignores a value that is not a date rather than counting to NaN", () => {
    const day = openDayWindow({ OPEN_DAY_STARTS_AT: "next thursday-ish" });
    expect(Number.isNaN(day.startsAt.getTime())).toBe(false);
    expect(day.startsAt.getTime()).toBe(new Date(openDayWindow({}).startsAt).getTime());
  });

  it("gives the stand a working day when the end does not follow the start", () => {
    // The mistake this guards against is a start moved in a dashboard and an
    // end left where it was, which reads as a day that finished before it
    // began and would show the page as over.
    const day = openDayWindow({
      OPEN_DAY_STARTS_AT: "2026-11-05T10:00:00+03:00",
      OPEN_DAY_ENDS_AT: END,
    });
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(6 * 60 * 60 * 1000);
  });

  it("parses a moment, or takes the fallback", () => {
    expect(parseMoment(START, END).toISOString()).toBe("2026-09-30T07:00:00.000Z");
    expect(parseMoment("  ", END).toISOString()).toBe("2026-09-30T13:00:00.000Z");
    expect(parseMoment(null, END).toISOString()).toBe("2026-09-30T13:00:00.000Z");
    expect(parseMoment(undefined, END).toISOString()).toBe("2026-09-30T13:00:00.000Z");
  });
});

describe("what the open day page is counting to", () => {
  const day = openDayWindow({
    OPEN_DAY_STARTS_AT: "2026-09-30T10:00:00+03:00",
    OPEN_DAY_ENDS_AT: "2026-09-30T16:00:00+03:00",
  });
  const at = (iso: string) => new Date(iso);

  it("counts to the doors before they open", () => {
    expect(openDayPhase(day, at("2026-09-24T12:00:00+03:00"))).toBe("before");
    expect(nextOpenDayBoundary(day, at("2026-09-24T12:00:00+03:00"))).toEqual(day.startsAt);
  });

  it("switches to closing time on the second the stand opens", () => {
    expect(openDayPhase(day, at("2026-09-30T09:59:59+03:00"))).toBe("before");
    expect(openDayPhase(day, at("2026-09-30T10:00:00+03:00"))).toBe("during");
    expect(nextOpenDayBoundary(day, at("2026-09-30T10:00:00+03:00"))).toEqual(day.endsAt);
  });

  it("is over once the stand shuts, and stops counting", () => {
    expect(openDayPhase(day, at("2026-09-30T15:59:59+03:00"))).toBe("during");
    expect(openDayPhase(day, at("2026-09-30T16:00:00+03:00"))).toBe("after");
    expect(nextOpenDayBoundary(day, at("2026-10-02T09:00:00+03:00"))).toBeNull();
  });

  it("reads the clock in Amman whatever zone the reader is in", () => {
    // The same instant, formatted for a hall in Jordan. A phone still set to
    // London must not be told the stand opens at seven in the morning.
    expect(openDayClock(day.startsAt)).toBe("10:00");
    expect(openDayClock(day.endsAt)).toBe("16:00");
  });

  it("says the date the way somebody would say it out loud", () => {
    expect(openDayDateLabel(day)).toBe("Wednesday 30 September, 10:00 to 16:00");
  });

  it("names both days when the window somehow spans two", () => {
    const spread = openDayWindow({
      OPEN_DAY_STARTS_AT: "2026-09-30T22:00:00+03:00",
      OPEN_DAY_ENDS_AT: "2026-10-01T02:00:00+03:00",
    });
    expect(openDayDateLabel(spread)).toBe("Wednesday 30 September 22:00 to Thursday 1 October 02:00");
  });
});
