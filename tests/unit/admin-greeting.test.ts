import { describe, expect, it } from "vitest";
import { adminGreeting, relativeTime, timeOfDay } from "@/lib/admin-greeting";

/** Local time, because timeOfDay reads getHours() — the admin's clock, not UTC. */
const at = (hour: number, minute = 0) => new Date(2026, 8, 5, hour, minute);

describe("timeOfDay", () => {
  it("splits the day at the boundaries it claims", () => {
    expect(timeOfDay(at(4, 59))).toBe("evening");
    expect(timeOfDay(at(5, 0))).toBe("morning");
    expect(timeOfDay(at(11, 59))).toBe("morning");
    expect(timeOfDay(at(12, 0))).toBe("afternoon");
    expect(timeOfDay(at(17, 59))).toBe("afternoon");
    expect(timeOfDay(at(18, 0))).toBe("evening");
  });

  it("covers the small hours rather than calling 2am morning", () => {
    // The bug every one of these functions has: three buckets that only add up
    // to eighteen hours, and 02:00 falling through to whatever came last.
    expect(timeOfDay(at(0))).toBe("evening");
    expect(timeOfDay(at(2))).toBe("evening");
    expect(timeOfDay(at(23))).toBe("evening");
  });
});

describe("relativeTime", () => {
  const now = at(12, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("counts in the units a person would", () => {
    expect(relativeTime(ago(30 * 1000), now)).toBe("just now");
    expect(relativeTime(ago(MIN), now)).toBe("1 minute ago");
    expect(relativeTime(ago(5 * MIN), now)).toBe("5 minutes ago");
    expect(relativeTime(ago(HOUR), now)).toBe("1 hour ago");
    expect(relativeTime(ago(3 * HOUR), now)).toBe("3 hours ago");
    expect(relativeTime(ago(DAY), now)).toBe("yesterday");
    expect(relativeTime(ago(4 * DAY), now)).toBe("4 days ago");
    expect(relativeTime(ago(45 * DAY), now)).toBe("1 month ago");
    expect(relativeTime(ago(90 * DAY), now)).toBe("3 months ago");
  });

  it("does not count forwards when the stored time is ahead of now", () => {
    // Clock skew between the database and the app, or a machine whose clock was
    // put back. "in -2 minutes" is not worth a special case; it is just now.
    expect(relativeTime(new Date(now.getTime() + 5 * MIN), now)).toBe("just now");
  });
});

describe("adminGreeting", () => {
  const now = at(19, 30);
  const oldAccount = new Date(2026, 0, 1);

  it("greets by name, at the right time of day", () => {
    expect(adminGreeting("hatem", null, oldAccount, now).headline).toBe("Good evening, hatem.");
    expect(adminGreeting("hatem", null, oldAccount, at(9)).headline).toBe("Good morning, hatem.");
  });

  it("reports the previous visit when there is one on record", () => {
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    expect(adminGreeting("hatem", threeHoursAgo, oldAccount, now).detail).toBe(
      "You were last here 3 hours ago.",
    );
  });

  it("welcomes a brand new account", () => {
    const madeThisMorning = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    expect(adminGreeting("bayan", null, madeThisMorning, now).detail).toBe(
      "Welcome aboard — this is your first time here.",
    );
  });

  it("says nothing rather than guessing for an established account with no record", () => {
    // A row that predates the previousLoginAt column. It is not a first visit
    // and there is no previous visit to report, so the second line is dropped
    // rather than filled with something invented.
    expect(adminGreeting("hatem", null, oldAccount, now).detail).toBeNull();
  });
});
