import { describe, expect, it } from "vitest";
import { cleanWebsite, groupByTier, logoKey, sponsorFields } from "@/lib/sponsors";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("sponsors", () => {
  it("turns a typed website into a safe link", () => {
    expect(cleanWebsite("acme.com")).toBe("https://acme.com/");
    expect(cleanWebsite("http://acme.jo/about")).toBe("http://acme.jo/about");
    expect(cleanWebsite("")).toBe("");
    for (const bad of ["javascript:alert(1)", "mailto:a@b.com", "localhost", "not a site"]) expect(cleanWebsite(bad)).toBe("");
  });

  it("checks the desk form", () => {
    expect(sponsorFields(form({ name: "  Acme  ", tier: " Gold ", website: "acme.com" }))).toEqual({
      ok: true,
      name: "Acme",
      tier: "Gold",
      website: "https://acme.com/",
    });
    expect(sponsorFields(form({ name: "" })).ok).toBe(false);
    expect(sponsorFields(form({ name: "Acme", website: "javascript:alert(1)" })).ok).toBe(false);
    expect(sponsorFields(form({ name: "x".repeat(81) })).ok).toBe(false);
  });

  it("stores a logo under a readable name", () => {
    expect(logoKey("Acme Robotics", "image/png", "abc")).toBe("sponsors/acme-robotics-abc.png");
  });

  it("groups by tier in the order the desk set", () => {
    const groups = groupByTier([
      { name: "A", tier: "Gold" },
      { name: "B", tier: "" },
      { name: "C", tier: "gold" },
      { name: "D", tier: "Silver" },
    ]);
    expect(groups.map((group) => [group.tier, group.sponsors.map((s) => s.name)])).toEqual([
      ["Gold", ["A", "C"]],
      ["", ["B"]],
      ["Silver", ["D"]],
    ]);
  });
});
