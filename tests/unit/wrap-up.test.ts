import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEVELOPER_MESSAGE,
  DEVELOPER_MESSAGE_MAX,
  messageParagraphs,
  parseDeveloperMessage,
  withWrapUp,
  wrapUpMenuHidden,
} from "@/lib/wrap-up";
import { nextPlace, previousPlace, scrollFor, type JourneyStop } from "@/lib/journey";
import { JOURNEY_STOPS } from "@/lib/journey-stops";

describe("wrap-up switch", () => {
  it("shuts registration and leaves the rest alone", () => {
    expect([...withWrapUp(["/gallery"], true)].sort()).toEqual(["/gallery", "/register"]);
    expect([...withWrapUp(["/gallery"], false)]).toEqual(["/gallery"]);
  });

  it("takes the pages about the day out of the menu", () => {
    expect(wrapUpMenuHidden(true)).toEqual(expect.arrayContaining(["/register", "/competition-day", "/open-day", "/schedule"]));
    expect(wrapUpMenuHidden(true)).not.toContain("/rules");
    expect(wrapUpMenuHidden(false)).toEqual([]);
  });

  it("does not change the set it was given", () => {
    const given = new Set(["/faq"]);
    withWrapUp(given, true);
    expect([...given]).toEqual(["/faq"]);
  });
});

describe("developer message", () => {
  it("keeps paragraphs, trims and caps", () => {
    expect(parseDeveloperMessage("  Hello\r\n\r\n\r\n\r\nWorld  ")).toBe("Hello\n\nWorld");
    expect(parseDeveloperMessage("x".repeat(DEVELOPER_MESSAGE_MAX + 50))).toHaveLength(DEVELOPER_MESSAGE_MAX);
    expect(parseDeveloperMessage(null)).toBe("");
  });

  it("falls back to the draft when nothing is written", () => {
    expect(messageParagraphs("")).toEqual(DEFAULT_DEVELOPER_MESSAGE.split("\n\n"));
    expect(messageParagraphs("One\n\nTwo")).toEqual(["One", "Two"]);
  });

  it("the draft reads like a person wrote it", () => {
    expect(DEFAULT_DEVELOPER_MESSAGE).not.toMatch(/[—–]/);
  });
});

describe("journey", () => {
  const stop = (notes: number): JourneyStop => ({
    id: String(notes),
    era: "registration",
    path: "/",
    live: true,
    title: "t",
    intro: "i",
    image: { src: "", width: 1, height: 1 },
    phone: null,
    notes: Array.from({ length: notes }, (_, i) => ({ title: `n${i}`, body: "", x: 0.5, y: 0.5, phoneY: null })),
  });
  const stops = [stop(2), stop(1)];

  it("steps note by note, then stop by stop, and ends", () => {
    expect(nextPlace(stops, { stop: 0, note: 0 })).toEqual({ stop: 0, note: 1 });
    expect(nextPlace(stops, { stop: 0, note: 1 })).toEqual({ stop: 1, note: 0 });
    expect(nextPlace(stops, { stop: 1, note: 0 })).toBeNull();
  });

  it("steps back to the last note of the stop before", () => {
    expect(previousPlace(stops, { stop: 1, note: 0 })).toEqual({ stop: 0, note: 1 });
    expect(previousPlace(stops, { stop: 0, note: 0 })).toBeNull();
  });

  it("scrolls a note a third of the way down the frame, inside the capture", () => {
    expect(scrollFor(0.5, 3000, 600)).toBe(1300);
    expect(scrollFor(0, 3000, 600)).toBe(0);
    expect(scrollFor(1, 3000, 600)).toBe(2400);
  });

  it("every stop has a capture and notes that land on it", () => {
    expect(JOURNEY_STOPS.length).toBeGreaterThan(8);
    expect(new Set(JOURNEY_STOPS.map((s) => s.era))).toEqual(new Set(["registration", "day"]));
    for (const s of JOURNEY_STOPS) {
      expect(s.notes.length).toBeGreaterThan(0);
      for (const note of s.notes) {
        expect(note.y).toBeGreaterThan(0);
        expect(note.y).toBeLessThan(1);
        expect(note.body).not.toMatch(/[—–]/);
      }
    }
  });
});

describe("splash credit", () => {
  it("holds the splash long enough to read the credit, and not when there is none", async () => {
    const { splashHoldMs, splashHoldWithCreditMs, SPLASH_CREDIT_MS } = await import("@/lib/splash");
    expect(splashHoldWithCreditMs("full", 3000, false)).toBe(splashHoldMs("full", 3000));
    expect(splashHoldWithCreditMs("full", 3000, true)).toBe(splashHoldMs("full", 3000) + SPLASH_CREDIT_MS);
    expect(splashHoldWithCreditMs("brief", undefined, true)).toBe(splashHoldMs("brief") + SPLASH_CREDIT_MS);
    expect(splashHoldWithCreditMs("none", 3000, true)).toBe(0);
  });
});
