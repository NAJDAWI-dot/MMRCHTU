import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_MAX,
  DAY_MODE_HIDDEN_PAGES,
  clockTime,
  dayKey,
  dayModeMenuHidden,
  eventsForDay,
  parseAnnouncement,
  postedAgo,
  sortAnnouncements,
  withDayMode,
} from "@/lib/day-mode";
import { MANAGED_PAGES, isManagedPage } from "@/lib/pages";

describe("what day mode hides", () => {
  it("takes Register and Rules down", () => {
    expect([...DAY_MODE_HIDDEN_PAGES].sort()).toEqual(["/register", "/rules"]);
  });

  it("only hides pages the Pages tab also knows about, so admins can still reach them", () => {
    for (const href of DAY_MODE_HIDDEN_PAGES) expect(isManagedPage(href)).toBe(true);
  });

  it("adds its pages while on and nothing while off", () => {
    expect([...withDayMode(["/gallery"], false)]).toEqual(["/gallery"]);
    expect(withDayMode(["/gallery"], true)).toEqual(new Set(["/gallery", "/register", "/rules"]));
  });

  it("never touches the set it was given, which is shared for the whole request", () => {
    const admin = new Set(["/faq"]);
    withDayMode(admin, true);
    expect([...admin]).toEqual(["/faq"]);
  });

  it("leaves the homepage alone, since that is where the day site lives", () => {
    expect(withDayMode([], true).has("/")).toBe(false);
    expect(dayModeMenuHidden(true)).not.toContain("/");
  });

  it("drops Competition Day and Open Day from the menu only while on", () => {
    expect(dayModeMenuHidden(false)).toEqual([]);
    expect(dayModeMenuHidden(true)).toEqual(
      expect.arrayContaining(["/register", "/rules", "/competition-day", "/open-day"]),
    );
    // Every one of them is a real page, not a typo that hides nothing.
    const known = new Set(MANAGED_PAGES.map((page) => page.href));
    for (const href of dayModeMenuHidden(true)) expect(known.has(href)).toBe(true);
  });
});

describe("parseAnnouncement", () => {
  it("trims and refuses empty text", () => {
    expect(parseAnnouncement("  Round two at 14:00  ")).toBe("Round two at 14:00");
    expect(parseAnnouncement("   \n  ")).toBeNull();
    expect(parseAnnouncement(null)).toBeNull();
  });

  it("collapses runs of blank lines and Windows line endings", () => {
    expect(parseAnnouncement("One\r\n\r\n\r\n\r\nTwo")).toBe("One\n\nTwo");
  });

  it("caps the length", () => {
    expect(parseAnnouncement("x".repeat(1000))).toHaveLength(ANNOUNCEMENT_MAX);
  });
});

describe("sortAnnouncements", () => {
  const at = (iso: string) => new Date(iso);
  it("puts pinned first, newest first within each group", () => {
    const sorted = sortAnnouncements([
      { id: "old", isPinned: false, createdAt: at("2026-11-14T08:00:00Z") },
      { id: "pin-old", isPinned: true, createdAt: at("2026-11-14T07:00:00Z") },
      { id: "new", isPinned: false, createdAt: at("2026-11-14T10:00:00Z") },
      { id: "pin-new", isPinned: true, createdAt: at("2026-11-14T09:00:00Z") },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["pin-new", "pin-old", "new", "old"]);
  });
});

describe("Amman time", () => {
  it("reads the clock in Amman whatever the server's zone", () => {
    // 11:05 UTC is 14:05 in Amman (UTC+3).
    expect(clockTime(new Date("2026-11-14T11:05:00Z"))).toBe("14:05");
  });

  it("puts 22:30 UTC on the next Amman day", () => {
    expect(dayKey(new Date("2026-11-14T22:30:00Z"))).toBe("2026-11-15");
  });

  it("says how long ago in the words a hall uses", () => {
    const now = new Date("2026-11-14T11:00:00Z");
    expect(postedAgo(new Date("2026-11-14T10:59:40Z"), now)).toBe("just now");
    expect(postedAgo(new Date("2026-11-14T10:48:00Z"), now)).toBe("12 min ago");
    expect(postedAgo(new Date("2026-11-14T07:40:00Z"), now)).toBe("at 10:40");
    expect(postedAgo(new Date("2026-11-12T07:40:00Z"), now)).toMatch(/12 Nov/);
  });
});

describe("eventsForDay", () => {
  const event = (id: string, iso: string) => ({ id, startsAt: new Date(iso) });
  const events = [
    event("deadline", "2026-10-01T09:00:00Z"),
    event("final", "2026-11-14T13:00:00Z"),
    event("doors", "2026-11-14T06:00:00Z"),
    event("after", "2026-11-20T09:00:00Z"),
  ];

  it("keeps only the competition day, in order, when a date is set", () => {
    const picked = eventsForDay(events, new Date("2026-11-14T07:00:00Z"), new Date("2026-10-10T00:00:00Z"));
    expect(picked.map((e) => e.id)).toEqual(["doors", "final"]);
  });

  it("falls back to everything from today when nothing is on that date", () => {
    const picked = eventsForDay(events, new Date("2026-12-01T07:00:00Z"), new Date("2026-11-14T05:00:00Z"));
    expect(picked.map((e) => e.id)).toEqual(["doors", "final", "after"]);
  });

  it("keeps an event that runs on past midnight with the day it belongs to", () => {
    // 21:00 and 00:30 Amman: the second is after midnight but the same night.
    const late = [event("round", "2026-11-14T18:00:00Z"), event("prizes", "2026-11-14T21:30:00Z")];
    const picked = eventsForDay(late, new Date("2026-11-14T06:00:00Z"), new Date("2026-11-14T20:00:00Z"));
    expect(picked.map((e) => e.id)).toEqual(["round", "prizes"]);
  });

  it("but not the next morning's events", () => {
    const next = [event("today", "2026-11-14T08:00:00Z"), event("tomorrow", "2026-11-15T06:00:00Z")];
    const picked = eventsForDay(next, new Date("2026-11-14T06:00:00Z"), new Date("2026-11-14T07:00:00Z"));
    expect(picked.map((e) => e.id)).toEqual(["today"]);
  });

  it("falls back the same way with no date at all", () => {
    const picked = eventsForDay(events, null, new Date("2026-11-15T05:00:00Z"));
    expect(picked.map((e) => e.id)).toEqual(["after"]);
  });
});
