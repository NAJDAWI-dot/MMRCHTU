import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_EDGE,
  MAX_UPLOAD_BYTES,
  checkUpload,
  fitWithin,
  formatBytes,
  isAllowedImageType,
  reorder,
  slugify,
  sniffImageType,
  sortAlbums,
  storageKey,
  uniqueSlug,
} from "@/lib/gallery";
import { toDateTimeLocal } from "@/lib/competition-day";

describe("slugify", () => {
  it("makes a URL-safe slug from a title", () => {
    expect(slugify("MMRC 26 Finals")).toBe("mmrc-26-finals");
  });

  it("strips accents so one album cannot become two different URLs", () => {
    expect(slugify("Café Sessión")).toBe("cafe-session");
  });

  it("collapses punctuation and trims stray hyphens", () => {
    expect(slugify("  Day 1 — Heats & Finals!  ")).toBe("day-1-heats-finals");
  });

  it("returns empty for a title with nothing latin in it", () => {
    // Handled by uniqueSlug, which falls back to a usable name.
    expect(slugify("مسابقة")).toBe("");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify("a".repeat(50) + " " + "b".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("uses the plain slug when it is free", () => {
    expect(uniqueSlug("MMRC 26 Finals", [])).toBe("mmrc-26-finals");
  });

  it("suffixes rather than colliding", () => {
    expect(uniqueSlug("Finals", ["finals"])).toBe("finals-2");
    expect(uniqueSlug("Finals", ["finals", "finals-2"])).toBe("finals-3");
  });

  it("still produces a URL for a title that slugifies to nothing", () => {
    expect(uniqueSlug("مسابقة", [])).toBe("album");
    expect(uniqueSlug("!!!", ["album"])).toBe("album-2");
  });
});

describe("storageKey", () => {
  it("takes its extension from the verified type and namespaces by album", () => {
    expect(storageKey("finals", "image/jpeg", "abc")).toBe("gallery/finals/finals-abc.jpg");
  });

  it("names the file after the album, since that is what a download is called", () => {
    // Downloads are named from the file part only, so a bare id would land in
    // someone's downloads folder as an unplaceable "abc.jpg".
    const key = storageKey("mmrc-26-finals", "image/jpeg", "k3f9a1");
    expect(key.split("/").pop()).toBe("mmrc-26-finals-k3f9a1.jpg");
  });

  it("gives every accepted type its own extension", () => {
    // The extension is what blob storage serves the file as, so these must map
    // one-to-one onto the types the sniffer can return.
    expect(storageKey("a", "image/png", "k").endsWith(".png")).toBe(true);
    expect(storageKey("a", "image/webp", "k").endsWith(".webp")).toBe(true);
    expect(storageKey("a", "image/avif", "k").endsWith(".avif")).toBe(true);
  });

  it("carries nothing at all from the upload, so no name can escape the folder", () => {
    // There is no longer a parameter a filename could arrive in — which is the
    // point. Only the album segment and the caller's unique part shape the key.
    const key = storageKey("finals", "image/jpeg", "abc");
    expect(key).toBe("gallery/finals/finals-abc.jpg");
    expect(key).not.toContain("..");
  });

  it("sanitises the album segment too", () => {
    expect(storageKey("../evil", "image/png", "k")).toBe("gallery/evil/evil-k.png");
  });
});

describe("sniffImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

  it("recognises a PNG by its signature", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe(
      "image/png",
    );
  });

  it("recognises a JPEG by its signature", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
  });

  it("recognises a WebP by its RIFF form type, not just the container", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
    // RIFF alone is a container shared with WAV and AVI.
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
  });

  it("recognises AVIF from the major brand", () => {
    expect(sniffImageType(bytes(0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii("avif")))).toBe(
      "image/avif",
    );
  });

  it("recognises AVIF from a compatible brand, which is where encoders often put it", () => {
    const head = bytes(
      0, 0, 0, 0x20,
      ...ascii("ftyp"),
      ...ascii("mif1"), // major brand
      0, 0, 0, 0, // minor version
      ...ascii("mif1"),
      ...ascii("avif"), // compatible brand
    );
    expect(sniffImageType(head)).toBe("image/avif");
  });

  it("does not accept HEIC, which shares the container but is not on the list", () => {
    const heic = bytes(0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii("heic"), 0, 0, 0, 0, ...ascii("heic"));
    expect(sniffImageType(heic)).toBeNull();
  });

  it("rejects the payloads this check exists to stop", () => {
    // A declared image/png meant nothing; these are what actually arrived.
    expect(sniffImageType(bytes(...ascii("<!DOCTYPE html><script>")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("<svg xmlns=")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("GIF89a")))).toBeNull();
  });

  it("rejects an empty or truncated head rather than guessing", () => {
    expect(sniffImageType(bytes())).toBeNull();
    expect(sniffImageType(bytes(0x89, 0x50))).toBeNull();
    expect(sniffImageType(bytes(...ascii("RIFF")))).toBeNull();
  });
});

describe("checkUpload", () => {
  const file = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
    name: "photo.jpg",
    type: "image/jpeg",
    size: 500_000,
    ...over,
  });

  it("accepts a normal photo", () => {
    expect(checkUpload(file())).toBeNull();
  });

  it("rejects things that are not images we can show", () => {
    expect(checkUpload(file({ type: "application/pdf" }))).toMatch(/not an image/);
    expect(checkUpload(file({ type: "image/gif" }))).toMatch(/not an image/);
    expect(checkUpload(file({ type: "" }))).toMatch(/not an image/);
  });

  it("rejects an empty file", () => {
    expect(checkUpload(file({ size: 0 }))).toMatch(/empty/);
  });

  it("rejects anything over the limit and says by how much", () => {
    const problem = checkUpload(file({ size: MAX_UPLOAD_BYTES + 1 }));
    expect(problem).toMatch(/Too large/);
    expect(problem).toMatch(/limit is/);
  });

  it("accepts every type it claims to allow", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(isAllowedImageType(type), type).toBe(true);
      expect(checkUpload(file({ type })), type).toBeNull();
    }
  });
});

describe("fitWithin", () => {
  it("scales the longest edge down to the cap and keeps the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("never enlarges a small image", () => {
    // Upscaling would spend bandwidth delivering blur.
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });

  it("leaves an image exactly at the cap untouched", () => {
    expect(fitWithin(2000, 1000, 2000)).toEqual({ width: 2000, height: 1000 });
  });

  it("survives a zero dimension instead of dividing by it", () => {
    expect(fitWithin(0, 0, 2000)).toEqual({ width: 0, height: 0 });
  });

  it("defaults to the shared cap", () => {
    expect(fitWithin(6000, 3000).width).toBe(MAX_IMAGE_EDGE);
  });
});

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3_500_000)).toBe("3.3 MB");
  });
});

describe("reorder", () => {
  it("moves an item and keeps everything else", () => {
    expect(reorder(["a", "b", "c", "d"], 2, 0)).toEqual(["c", "a", "b", "d"]);
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("never loses or duplicates an item", () => {
    const out = reorder(["a", "b", "c", "d"], 1, 3);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores out-of-range moves rather than corrupting the list", () => {
    expect(reorder(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const input = ["a", "b", "c"];
    reorder(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("sortAlbums", () => {
  const album = (title: string, eventDate: Date | null, sortOrder = 0) => ({
    title,
    eventDate,
    sortOrder,
  });

  it("puts newest events first", () => {
    const sorted = sortAlbums([
      album("Old", new Date(2025, 0, 1)),
      album("New", new Date(2026, 0, 1)),
    ]);
    expect(sorted.map((a) => a.title)).toEqual(["New", "Old"]);
  });

  it("lets sortOrder override the date", () => {
    const sorted = sortAlbums([
      album("Pinned", new Date(2020, 0, 1), -1),
      album("Recent", new Date(2026, 0, 1), 0),
    ]);
    expect(sorted.map((a) => a.title)).toEqual(["Pinned", "Recent"]);
  });

  it("sends undated albums to the end rather than the front", () => {
    const sorted = sortAlbums([album("Undated", null), album("Dated", new Date(2020, 0, 1))]);
    expect(sorted.map((a) => a.title)).toEqual(["Dated", "Undated"]);
  });

  it("falls back to title so the order is stable", () => {
    const sorted = sortAlbums([album("B", null), album("A", null)]);
    expect(sorted.map((a) => a.title)).toEqual(["A", "B"]);
  });
});

describe("toDateTimeLocal", () => {
  it("formats for a datetime-local input", () => {
    expect(toDateTimeLocal(new Date(2026, 3, 18, 9, 5))).toBe("2026-04-18T09:05");
  });

  it("uses local time, not UTC", () => {
    // toISOString() would shift this by the machine's offset and show the
    // admin a time that is not the one they set.
    const date = new Date(2026, 3, 18, 23, 30);
    expect(toDateTimeLocal(date)).toBe("2026-04-18T23:30");
  });

  it("is blank for no date, so the input simply shows empty", () => {
    expect(toDateTimeLocal(null)).toBe("");
    expect(toDateTimeLocal(undefined)).toBe("");
    expect(toDateTimeLocal(new Date("nonsense"))).toBe("");
  });
});
