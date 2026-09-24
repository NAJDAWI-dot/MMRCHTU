import { describe, expect, it } from "vitest";
import { dayTarget, openDaySite } from "@/lib/day-links";

describe("opening the day site from Day HQ", () => {
  it("goes through the route that turns draft mode back on", () => {
    expect(openDaySite()).toBe("/day/hq/open?to=%2Fday");
    expect(openDaySite("/day/screen?panel=sponsors")).toBe("/day/hq/open?to=%2Fday%2Fscreen%3Fpanel%3Dsponsors");
  });

  it("only ever sends someone to a day site page", () => {
    expect(dayTarget("/day/screen")).toBe("/day/screen");
    expect(dayTarget("/day/screen?panel=sponsors")).toBe("/day/screen?panel=sponsors");
    expect(dayTarget("/day")).toBe("/day");
    for (const bad of [null, "", "https://evil.test", "//evil.test", "/admin", "/dayz", "/day/../admin", "/day/hq/open?to=x"]) {
      expect(dayTarget(bad)).toBe("/day");
    }
  });
});
