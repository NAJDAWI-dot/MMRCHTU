import { describe, expect, it } from "vitest";
import { cleanWebsite, groupByTier, logoBackgroundFor, logoKey, parseLogoBackground, sponsorFields } from "@/lib/sponsors";

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

describe("logoBackgroundFor", () => {
  /** A logo of `size` pixels: `ink` of them in one colour, the rest see-through or a background colour. */
  const logo = (ink: [number, number, number], share: number, rest: [number, number, number, number] = [0, 0, 0, 0], size = 100) => {
    const pixels: number[] = [];
    for (let i = 0; i < size; i++) pixels.push(...(i < share * size ? [...ink, 255] : rest));
    return pixels;
  };

  it("puts a white logo on a transparent background on the dark tile", () => {
    expect(logoBackgroundFor(logo([255, 255, 255], 0.3))).toBe("DARK");
    expect(logoBackgroundFor(logo([235, 238, 240], 0.3))).toBe("DARK");
  });

  it("keeps a dark or coloured logo on white", () => {
    expect(logoBackgroundFor(logo([20, 20, 20], 0.3))).toBe("WHITE");
    expect(logoBackgroundFor(logo([200, 30, 40], 0.3))).toBe("WHITE");
  });

  it("puts white lettering with a coloured mark on the dark tile, where both show", () => {
    const pixels = [...logo([255, 255, 255], 0.2, [0, 0, 0, 0], 50), ...logo([200, 30, 40], 0.2, [0, 0, 0, 0], 50)];
    expect(logoBackgroundFor(pixels)).toBe("DARK");
  });

  it("keeps a logo with its own background on white", () => {
    expect(logoBackgroundFor(logo([255, 255, 255], 0.3, [10, 10, 60, 255]))).toBe("WHITE");
  });

  it("keeps an empty image on white", () => {
    expect(logoBackgroundFor([])).toBe("WHITE");
    expect(logoBackgroundFor(logo([255, 255, 255], 0))).toBe("WHITE");
  });
});

describe("parseLogoBackground", () => {
  it("reads DARK and takes anything else as WHITE", () => {
    expect(parseLogoBackground("DARK")).toBe("DARK");
    expect(parseLogoBackground("WHITE")).toBe("WHITE");
    expect(parseLogoBackground("<script>")).toBe("WHITE");
    expect(parseLogoBackground(null)).toBe("WHITE");
  });
});
