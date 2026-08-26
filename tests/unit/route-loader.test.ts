import { describe, expect, it } from "vitest";
import {
  ROUTE_LOADER_FADE_MS,
  ROUTE_LOADER_MIN_MS,
  ROUTE_LOADER_SAFETY_MS,
  remainingHoldMs,
  shouldInterceptClick,
  type ClickIntent,
} from "@/lib/route-loader";

const ORIGIN = "https://mmrchtu.tech";
const HERE = "/rules";

/** An ordinary left-click on an internal link to somewhere else. */
function click(overrides: Partial<ClickIntent> = {}): ClickIntent {
  return { href: `${ORIGIN}/schedule`, button: 0, ...overrides };
}

describe("shouldInterceptClick", () => {
  it("covers an ordinary click on an internal link", () => {
    expect(shouldInterceptClick(click(), HERE, ORIGIN)).toBe(true);
  });

  it("ignores a click that hit no link at all", () => {
    expect(shouldInterceptClick(click({ href: null }), HERE, ORIGIN)).toBe(false);
  });

  it("ignores a click something else has already handled", () => {
    expect(shouldInterceptClick(click({ defaultPrevented: true }), HERE, ORIGIN)).toBe(false);
  });

  it.each([
    ["meta", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
  ])("ignores a %s-click, which opens elsewhere", (_label, mod) => {
    expect(shouldInterceptClick(click(mod), HERE, ORIGIN)).toBe(false);
  });

  it.each([1, 2])("ignores button %i, which is not a navigation", (button) => {
    expect(shouldInterceptClick(click({ button }), HERE, ORIGIN)).toBe(false);
  });

  it("ignores a download link", () => {
    expect(shouldInterceptClick(click({ download: true }), HERE, ORIGIN)).toBe(false);
  });

  it("ignores a link that opens in a new tab", () => {
    expect(shouldInterceptClick(click({ target: "_blank" }), HERE, ORIGIN)).toBe(false);
  });

  it("allows the targets that mean this tab", () => {
    expect(shouldInterceptClick(click({ target: "" }), HERE, ORIGIN)).toBe(true);
    expect(shouldInterceptClick(click({ target: "_self" }), HERE, ORIGIN)).toBe(true);
  });

  it("ignores another site, which takes the overlay with it", () => {
    expect(
      shouldInterceptClick(click({ href: "https://ieee.org/ras" }), HERE, ORIGIN),
    ).toBe(false);
  });

  it.each([
    "mailto:support@mmrchtu.tech",
    "tel:+962700000000",
  ])("ignores %s, which hands off to another application", (href) => {
    expect(shouldInterceptClick(click({ href }), HERE, ORIGIN)).toBe(false);
  });

  it("ignores a jump to the page already showing", () => {
    // The path never changes, so the loader would have nothing to wait for and
    // would sit there until the safety timer fired.
    expect(shouldInterceptClick(click({ href: `${ORIGIN}${HERE}` }), HERE, ORIGIN)).toBe(false);
    expect(
      shouldInterceptClick(click({ href: `${ORIGIN}${HERE}#robot-size` }), HERE, ORIGIN),
    ).toBe(false);
  });

  it("still covers a link to another page that carries a hash or a query", () => {
    expect(
      shouldInterceptClick(click({ href: `${ORIGIN}/schedule#day-two` }), HERE, ORIGIN),
    ).toBe(true);
    expect(
      shouldInterceptClick(click({ href: `${ORIGIN}/search?q=maze` }), HERE, ORIGIN),
    ).toBe(true);
  });

  it("ignores an unparseable href rather than throwing", () => {
    expect(shouldInterceptClick(click({ href: "http://[" }), HERE, ORIGIN)).toBe(false);
  });
});

describe("remainingHoldMs", () => {
  it("asks for the whole hold when no time has passed", () => {
    expect(remainingHoldMs(1000, 1000)).toBe(ROUTE_LOADER_MIN_MS);
  });

  it("asks for what is left partway through", () => {
    expect(remainingHoldMs(1000, 1000 + 200, 700)).toBe(500);
  });

  it("asks for nothing once the floor has passed", () => {
    // The hold is a minimum, never an addition: a genuinely slow route hides
    // the moment it arrives.
    expect(remainingHoldMs(1000, 1000 + 700, 700)).toBe(0);
    expect(remainingHoldMs(1000, 1000 + 5000, 700)).toBe(0);
  });

  it("never returns a negative wait", () => {
    expect(remainingHoldMs(1000, 99_999)).toBeGreaterThanOrEqual(0);
    // A clock that went backwards should still resolve, not wait forever.
    expect(remainingHoldMs(5000, 1000, 700)).toBe(700);
  });

  it("falls back to the full hold if the arithmetic is not a number", () => {
    expect(remainingHoldMs(Number.NaN, 1000, 700)).toBe(700);
  });
});

describe("timings", () => {
  it("holds long enough to read as deliberate, not so long as to obstruct", () => {
    expect(ROUTE_LOADER_MIN_MS).toBeGreaterThanOrEqual(400);
    expect(ROUTE_LOADER_MIN_MS).toBeLessThanOrEqual(1000);
  });

  it("keeps the backstop well clear of the ordinary hold", () => {
    expect(ROUTE_LOADER_SAFETY_MS).toBeGreaterThan(ROUTE_LOADER_MIN_MS * 5);
  });

  it("fades faster than it holds", () => {
    expect(ROUTE_LOADER_FADE_MS).toBeLessThan(ROUTE_LOADER_MIN_MS);
  });
});
