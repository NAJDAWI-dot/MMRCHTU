import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { absoluteUrl, siteOrigin } from "@/lib/site-url";

/**
 * These read process.env, so each test restores it — otherwise one test's
 * fixture leaks into the next and the failure looks unrelated to the cause.
 */
const KEYS = ["SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("siteOrigin", () => {
  it("falls back to localhost when nothing is configured", () => {
    expect(siteOrigin()).toBe("http://localhost:3000");
  });

  it("prefers an explicit SITE_URL above everything else", () => {
    process.env.SITE_URL = "https://mmrc26.org";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "mmrchtu.vercel.app";
    process.env.VERCEL_URL = "deployment-abc.vercel.app";
    expect(siteOrigin()).toBe("https://mmrc26.org");
  });

  it("prefers the stable production domain over the per-deployment one", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "mmrchtu.vercel.app";
    process.env.VERCEL_URL = "deployment-abc.vercel.app";
    expect(siteOrigin()).toBe("https://mmrchtu.vercel.app");
  });

  it("uses the deployment URL when that is all there is", () => {
    process.env.VERCEL_URL = "deployment-abc.vercel.app";
    expect(siteOrigin()).toBe("https://deployment-abc.vercel.app");
  });

  it("adds a scheme to a bare host", () => {
    process.env.SITE_URL = "mmrc26.org";
    expect(siteOrigin()).toBe("https://mmrc26.org");
  });

  it("keeps an http scheme that was given deliberately", () => {
    process.env.SITE_URL = "http://localhost:4000";
    expect(siteOrigin()).toBe("http://localhost:4000");
  });

  it("never ends in a slash, however the value was written", () => {
    for (const value of ["https://mmrc26.org/", "https://mmrc26.org///"]) {
      process.env.SITE_URL = value;
      expect(siteOrigin()).toBe("https://mmrc26.org");
    }
  });
});

describe("absoluteUrl", () => {
  beforeEach(() => {
    process.env.SITE_URL = "https://mmrc26.org";
  });

  it("joins a path onto the origin", () => {
    expect(absoluteUrl("/rules")).toBe("https://mmrc26.org/rules");
  });

  it("tolerates a path given without its leading slash", () => {
    expect(absoluteUrl("rules")).toBe("https://mmrc26.org/rules");
  });

  it("produces a bare origin for the root", () => {
    expect(absoluteUrl("/")).toBe("https://mmrc26.org/");
  });
});
