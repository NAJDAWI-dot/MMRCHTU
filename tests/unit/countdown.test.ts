import { describe, expect, it } from "vitest";
import {
  countdownSentence,
  countdownUnits,
  pad,
  remainingUntil,
  shouldShowCountdown,
  showsSeconds,
  tickIntervalMs,
} from "@/lib/countdown";

const BASE = new Date(2026, 3, 18, 9, 0, 0);
const after = (ms: number) => new Date(BASE.getTime() + ms);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("remainingUntil", () => {
  it("splits the gap into whole units", () => {
    const r = remainingUntil(after(2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND), BASE);
    expect(r).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
  });

  it("clamps at zero rather than going negative once the date has passed", () => {
    // Every caller would otherwise have to guard against "-3 days".
    const r = remainingUntil(after(-5 * DAY), BASE);
    expect(r).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, done: true });
  });

  it("is done exactly on the target, not a second later", () => {
    expect(remainingUntil(BASE, BASE).done).toBe(true);
    expect(remainingUntil(after(1), BASE).done).toBe(false);
  });

  it("handles the final second", () => {
    const r = remainingUntil(after(SECOND), BASE);
    expect(r.seconds).toBe(1);
    expect(r.done).toBe(false);
  });

  it("does not roll a partial unit up into the next one", () => {
    // 59 minutes 59 seconds is 0 hours, not 1.
    const r = remainingUntil(after(59 * MINUTE + 59 * SECOND), BASE);
    expect(r.hours).toBe(0);
    expect(r.minutes).toBe(59);
  });
});

describe("showsSeconds and tickIntervalMs", () => {
  it("shows seconds however far out the date is", () => {
    // Without a digit that changes every second the clock reads as a graphic.
    expect(showsSeconds(remainingUntil(after(90 * DAY), BASE))).toBe(true);
    expect(showsSeconds(remainingUntil(after(DAY + MINUTE), BASE))).toBe(true);
    expect(showsSeconds(remainingUntil(after(DAY - MINUTE), BASE))).toBe(true);
  });

  it("ticks once a second at any distance, since seconds are always shown", () => {
    expect(tickIntervalMs(remainingUntil(after(30 * DAY), BASE))).toBe(SECOND);
    expect(tickIntervalMs(remainingUntil(after(2 * HOUR), BASE))).toBe(SECOND);
    expect(MINUTE).toBe(60 * SECOND); // guards the constants above from drifting
  });
});

describe("pad", () => {
  it("keeps digits two wide so the display does not jitter", () => {
    expect(pad(0)).toBe("00");
    expect(pad(7)).toBe("07");
    expect(pad(42)).toBe("42");
  });

  it("leaves numbers wider than two digits alone", () => {
    expect(pad(120)).toBe("120");
  });
});

describe("countdownUnits", () => {
  it("leads with days when there are any, and still carries seconds", () => {
    const units = countdownUnits(remainingUntil(after(3 * DAY + 2 * HOUR), BASE));
    expect(units.map((u) => u.label)).toEqual(["days", "hours", "minutes", "seconds"]);
    expect(units[0]).toEqual({ value: "3", label: "days" });
  });

  it("drops days entirely on the final day rather than showing a dead zero", () => {
    const units = countdownUnits(remainingUntil(after(4 * HOUR + 12 * MINUTE + 30 * SECOND), BASE));
    expect(units.map((u) => u.label)).toEqual(["hours", "minutes", "seconds"]);
    expect(units.map((u) => u.value)).toEqual(["04", "12", "30"]);
  });

  it("uses singular labels for exactly one", () => {
    const units = countdownUnits(
      remainingUntil(after(1 * DAY + 1 * HOUR + 1 * MINUTE + 1 * SECOND), BASE),
    );
    expect(units.map((u) => u.label)).toEqual(["day", "hour", "minute", "second"]);
  });
});

describe("countdownSentence", () => {
  it("reads as a sentence for screen readers", () => {
    expect(countdownSentence(remainingUntil(after(3 * DAY + 2 * HOUR), BASE))).toBe(
      "3 days and 2 hours until competition day.",
    );
  });

  it("joins three parts with commas and a final 'and'", () => {
    const s = countdownSentence(remainingUntil(after(2 * HOUR + 30 * MINUTE), BASE));
    expect(s).toBe("2 hours and 30 minutes until competition day.");
  });

  it("says it plainly once the moment arrives", () => {
    expect(countdownSentence(remainingUntil(BASE, BASE))).toBe("Competition day is here.");
  });

  it("handles the last minute without producing an empty sentence", () => {
    expect(countdownSentence(remainingUntil(after(30 * SECOND), BASE))).toBe(
      "Less than a minute until competition day.",
    );
  });

  it("omits minutes when days are the headline, to stay readable", () => {
    // "90 days and 12 minutes" is noise.
    const s = countdownSentence(remainingUntil(after(90 * DAY + 12 * MINUTE), BASE));
    expect(s).toBe("90 days until competition day.");
  });
});

describe("shouldShowCountdown", () => {
  it("shows nothing when no date is set", () => {
    expect(shouldShowCountdown(null, BASE)).toBe(false);
    expect(shouldShowCountdown(undefined, BASE)).toBe(false);
  });

  it("hides once the date has passed", () => {
    expect(shouldShowCountdown(after(-1), BASE)).toBe(false);
  });

  it("shows for a date within the year", () => {
    expect(shouldShowCountdown(after(30 * DAY), BASE)).toBe(true);
    expect(shouldShowCountdown(after(SECOND), BASE)).toBe(true);
  });

  it("hides an implausibly distant date, which is a typo not a feature", () => {
    // A clock reading "412 days" means someone entered the wrong year.
    expect(shouldShowCountdown(after(400 * DAY), BASE)).toBe(false);
  });
});
