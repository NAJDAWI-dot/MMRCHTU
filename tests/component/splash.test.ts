import { describe, expect, it } from "vitest";
import {
  splashMode,
  splashHoldMs,
  splashPrePaintScript,
  SPLASH_PENDING_CLASS,
  SPLASH_BRIEF_MS,
  SPLASH_FULL_MS,
} from "@/lib/splash";

describe("splashMode", () => {
  it("plays the full run", () => {
    expect(splashMode({ reducedMotion: false })).toBe("full");
  });

  it("downgrades to a static hold rather than skipping for reduced motion", () => {
    // The setting is about moving imagery, not about opting out of branding.
    expect(splashMode({ reducedMotion: true })).toBe("brief");
  });

  it("never returns none, because every document load is due a splash", () => {
    // It used to, for a visitor who had already seen it in this tab. The intro
    // now replays on refresh by design; client-side navigation gets the route
    // loader instead, and never reaches this code.
    expect(splashMode({ reducedMotion: false })).not.toBe("none");
    expect(splashMode({ reducedMotion: true })).not.toBe("none");
  });
});

describe("splashHoldMs", () => {
  it("holds nothing when there is no splash", () => {
    expect(splashHoldMs("none")).toBe(0);
  });

  it("holds the brief window for reduced motion and the full one otherwise", () => {
    expect(splashHoldMs("brief")).toBe(SPLASH_BRIEF_MS);
    expect(splashHoldMs("full")).toBe(SPLASH_FULL_MS);
  });

  it("keeps the reduced-motion hold shorter than the full run", () => {
    expect(splashHoldMs("brief")).toBeLessThan(splashHoldMs("full"));
  });
});

describe("splashPrePaintScript", () => {
  const src = splashPrePaintScript();

  it("carries the same class the component and CSS use", () => {
    // Interpolated from the constant, so a rename cannot desync the two.
    expect(src).toContain(JSON.stringify(SPLASH_PENDING_CLASS));
  });

  it("fails safe if anything throws", () => {
    // This is the first script on the page. Failing with the overlay hidden
    // leaves a normal-looking site; failing loudly would not.
    expect(src).toContain("try{");
    expect(src).toContain("catch(e){}");
  });

  it("runs immediately without leaking anything into global scope", () => {
    expect(src.startsWith("(function(){")).toBe(true);
    expect(src.trimEnd().endsWith("})();")).toBe(true);
  });

  it("consults no storage, so a reload is not treated as a repeat visit", () => {
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("localStorage");
  });

  it("always adds the class", () => {
    const run = () => {
      const classes: string[] = [];
      const fn = new Function("document", src) as (d: unknown) => void;
      fn({ documentElement: { classList: { add: (c: string) => classes.push(c) } } });
      return classes;
    };

    // Twice, standing in for two consecutive page loads: the second must be
    // treated exactly like the first.
    expect(run()).toEqual([SPLASH_PENDING_CLASS]);
    expect(run()).toEqual([SPLASH_PENDING_CLASS]);
  });
});
