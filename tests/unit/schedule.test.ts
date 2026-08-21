import { describe, expect, it } from "vitest";
import {
  STATE_LABELS,
  buildTimeline,
  daysBetween,
  focusEvent,
  isHappeningNow,
  isSameDay,
  relativeWhen,
  scheduleProgress,
  type ScheduleItemInput,
} from "@/lib/schedule";

/** Fixed clock, so "today" means the same thing on every run. */
const NOW = new Date("2026-06-15T12:00:00");

const at = (iso: string): Date => new Date(iso);

const event = (id: string, startsAt: string, endsAt?: string): ScheduleItemInput => ({
  id,
  title: `Event ${id}`,
  description: "",
  startsAt: at(startsAt),
  endsAt: endsAt ? at(endsAt) : null,
});

describe("daysBetween", () => {
  it("counts calendar days, not 24-hour blocks", () => {
    // Two hours apart, but a night in between — a reader calls that a day.
    expect(daysBetween(at("2026-06-15T23:00:00"), at("2026-06-16T01:00:00"))).toBe(1);
  });

  it("is zero within the same day and negative going back", () => {
    expect(daysBetween(at("2026-06-15T01:00:00"), at("2026-06-15T23:00:00"))).toBe(0);
    expect(daysBetween(at("2026-06-15T12:00:00"), at("2026-06-13T12:00:00"))).toBe(-2);
  });
});

describe("isSameDay", () => {
  it("ignores the time of day", () => {
    expect(isSameDay(at("2026-06-15T00:01:00"), at("2026-06-15T23:59:00"))).toBe(true);
    expect(isSameDay(at("2026-06-15T23:59:00"), at("2026-06-16T00:01:00"))).toBe(false);
  });
});

describe("isHappeningNow", () => {
  it("uses the end time when there is one", () => {
    const e = event("a", "2026-06-15T09:00:00", "2026-06-15T17:00:00");
    expect(isHappeningNow(e, at("2026-06-15T12:00:00"))).toBe(true);
    expect(isHappeningNow(e, at("2026-06-15T17:00:01"))).toBe(false);
    expect(isHappeningNow(e, at("2026-06-15T08:59:00"))).toBe(false);
  });

  it("gives an event with no end time an hour, so it does not flick straight to past", () => {
    const e = event("a", "2026-06-15T12:00:00");
    expect(isHappeningNow(e, at("2026-06-15T12:00:01"))).toBe(true);
    expect(isHappeningNow(e, at("2026-06-15T12:59:00"))).toBe(true);
    expect(isHappeningNow(e, at("2026-06-15T13:00:01"))).toBe(false);
  });
});

describe("relativeWhen", () => {
  it("describes today in hours and minutes", () => {
    expect(relativeWhen(at("2026-06-15T12:30:00"), NOW)).toBe("in 30 minutes");
    expect(relativeWhen(at("2026-06-15T15:00:00"), NOW)).toBe("in 3 hours");
    expect(relativeWhen(at("2026-06-15T12:00:30"), NOW)).toBe("any moment");
  });

  it("names the neighbouring days rather than counting them", () => {
    expect(relativeWhen(at("2026-06-16T12:00:00"), NOW)).toBe("tomorrow");
    expect(relativeWhen(at("2026-06-14T12:00:00"), NOW)).toBe("yesterday");
  });

  it("counts days, then weeks, then months as the gap widens", () => {
    expect(relativeWhen(at("2026-06-20T12:00:00"), NOW)).toBe("in 5 days");
    expect(relativeWhen(at("2026-07-06T12:00:00"), NOW)).toBe("in 3 weeks");
    expect(relativeWhen(at("2026-09-15T12:00:00"), NOW)).toBe("in 3 months");
  });

  it("reads the same phrases backwards once past", () => {
    expect(relativeWhen(at("2026-06-10T12:00:00"), NOW)).toBe("5 days ago");
    expect(relativeWhen(at("2026-05-25T12:00:00"), NOW)).toBe("3 weeks ago");
  });

  it("distinguishes earlier today from just now", () => {
    expect(relativeWhen(at("2026-06-15T08:00:00"), NOW)).toBe("earlier today");
    expect(relativeWhen(at("2026-06-15T11:59:30"), NOW)).toBe("just now");
  });
});

describe("buildTimeline", () => {
  const items = [
    event("c", "2026-07-20T10:00:00"),
    event("a", "2026-05-01T10:00:00"),
    event("b", "2026-06-20T10:00:00"),
  ];

  it("orders by start time whatever order it is given", () => {
    expect(buildTimeline(items, NOW).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("marks exactly one event as next", () => {
    const timeline = buildTimeline(items, NOW);
    expect(timeline.filter((i) => i.state === "next")).toHaveLength(1);
    expect(timeline.find((i) => i.state === "next")?.id).toBe("b");
  });

  it("marks everything before it past and everything after it upcoming", () => {
    const timeline = buildTimeline(items, NOW);
    expect(timeline.map((i) => i.state)).toEqual(["past", "next", "upcoming"]);
  });

  it("prefers happening-now over next", () => {
    const live = [event("a", "2026-06-15T09:00:00", "2026-06-15T17:00:00"), event("b", "2026-07-01T10:00:00")];
    const timeline = buildTimeline(live, NOW);
    expect(timeline[0]!.state).toBe("now");
    // The live event is the one still to finish, so nothing else is "next".
    expect(timeline[1]!.state).toBe("upcoming");
  });

  it("calls a later event on the same day today, not next", () => {
    const timeline = buildTimeline([event("a", "2026-06-15T18:00:00")], NOW);
    expect(timeline[0]!.state).toBe("today");
  });

  it("marks everything past once the whole schedule has run", () => {
    const timeline = buildTimeline(items, at("2027-01-01T00:00:00"));
    expect(timeline.every((i) => i.state === "past")).toBe(true);
    expect(timeline.filter((i) => i.state === "next")).toHaveLength(0);
  });

  it("attaches a readable when and a day count", () => {
    const timeline = buildTimeline(items, NOW);
    expect(timeline[1]!.when).toBe("in 5 days");
    expect(timeline[1]!.daysAway).toBe(5);
    expect(timeline[0]!.daysAway).toBeLessThan(0);
  });

  it("handles an empty schedule", () => {
    expect(buildTimeline([], NOW)).toEqual([]);
  });
});

describe("scheduleProgress", () => {
  it("counts completed events rather than elapsed time", () => {
    const items = [
      event("a", "2026-01-01T10:00:00"),
      event("b", "2026-02-01T10:00:00"),
      event("c", "2026-12-01T10:00:00"),
      event("d", "2026-12-02T10:00:00"),
    ];
    expect(scheduleProgress(buildTimeline(items, NOW))).toBe(50);
  });

  it("is zero for an empty schedule rather than dividing by nothing", () => {
    expect(scheduleProgress([])).toBe(0);
  });

  it("reaches 100 once everything has run", () => {
    const items = [event("a", "2026-01-01T10:00:00"), event("b", "2026-02-01T10:00:00")];
    expect(scheduleProgress(buildTimeline(items, NOW))).toBe(100);
  });
});

describe("focusEvent", () => {
  it("prefers a live event over the next one", () => {
    const timeline = buildTimeline(
      [event("live", "2026-06-15T09:00:00", "2026-06-15T17:00:00"), event("later", "2026-07-01T10:00:00")],
      NOW,
    );
    expect(focusEvent(timeline)?.id).toBe("live");
  });

  it("falls back to the next event", () => {
    const timeline = buildTimeline([event("a", "2026-01-01T10:00:00"), event("b", "2026-07-01T10:00:00")], NOW);
    expect(focusEvent(timeline)?.id).toBe("b");
  });

  it("returns nothing once the schedule is finished", () => {
    const timeline = buildTimeline([event("a", "2026-01-01T10:00:00")], NOW);
    expect(focusEvent(timeline)).toBeNull();
  });
});

describe("STATE_LABELS", () => {
  it("names every state the timeline can produce", () => {
    for (const state of ["past", "now", "today", "next", "upcoming"] as const) {
      expect(STATE_LABELS[state]).toBeTruthy();
    }
  });
});
