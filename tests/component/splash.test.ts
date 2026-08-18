import { describe, expect, it } from "vitest";
import {
  splashMode,
  splashHoldMs,
  splashPrePaintScript,
  SPLASH_SESSION_KEY,
  SPLASH_PENDING_CLASS,
  SPLASH_BRIEF_MS,
  SPLASH_FULL_MS,
} from "@/lib/splash";

describe("splashMode", () => {
  it("plays the full run for a first-time visitor", () => {
    expect(splashMode({ seen: false, reducedMotion: false })).toBe("full");
  });

  it("never replays once it has been seen in this tab", () => {
    expect(splashMode({ seen: true, reducedMotion: false })).toBe("none");
  });

  it("downgrades to a static hold rather than skipping for reduced motion", () => {
    // The setting is about moving imagery, not about opting out of branding.
    expect(splashMode({ seen: false, reducedMotion: true })).toBe("brief");
  });

  it("lets 'seen' win over reduced motion so it still never replays", () => {
    expect(splashMode({ seen: true, reducedMotion: true })).toBe("none");
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

  it("carries the same key and class the component and CSS use", () => {
    // Interpolated from the constants, so a rename cannot desync the two.
    expect(src).toContain(JSON.stringify(SPLASH_SESSION_KEY));
    expect(src).toContain(JSON.stringify(SPLASH_PENDING_CLASS));
  });

  it("fails safe if storage throws", () => {
    // Private-browsing modes can throw on sessionStorage access. Failing with
    // the overlay hidden leaves a normal-looking site; failing loudly would
    // not.
    expect(src).toContain("try{");
    expect(src).toContain("catch(e){}");
  });

  it("runs immediately without leaking anything into global scope", () => {
    expect(src.startsWith("(function(){")).toBe(true);
    expect(src.trimEnd().endsWith("})();")).toBe(true);
  });

  it("actually adds the class only when the key is unset", () => {
    const calls: string[] = [];
    const fakeStorage = (stored: string | null) => ({
      getItem: (k: string) => {
        calls.push(k);
        return stored;
      },
    });
    const run = (stored: string | null) => {
      const classes: string[] = [];
      const fn = new Function(
        "sessionStorage",
        "document",
        src
      ) as (s: unknown, d: unknown) => void;
      fn(fakeStorage(stored), {
        documentElement: { classList: { add: (c: string) => classes.push(c) } },
      });
      return classes;
    };

    expect(run(null)).toEqual([SPLASH_PENDING_CLASS]);
    expect(run("1")).toEqual([]);
    expect(calls).toEqual([SPLASH_SESSION_KEY, SPLASH_SESSION_KEY]);
  });
});
