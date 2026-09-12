import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOK_PAGES,
  PAGE_COUNT,
  type RulebookManifest,
  badgeLabel,
  contentsEntries,
  isHardPage,
  pageFromQuery,
  pdfPageIndex,
  spreadOf,
  toClientManifest,
} from "@/lib/rulebook-book";

const manifest = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "public/rulebook/manifest.json"), "utf8"),
) as RulebookManifest;

describe("the flip-book's running order", () => {
  it("binds every page of the PDF exactly once, in order", () => {
    const pdfPages = BOOK_PAGES.flatMap((page) => (page.kind === "pdf" ? [page.pdfPage] : []));
    expect(pdfPages).toEqual(manifest.pages.map((page) => page.number));
  });

  it("has an even page count, so the back cover closes the book on its own", () => {
    expect(PAGE_COUNT % 2).toBe(0);
    expect(BOOK_PAGES[0]).toEqual({ kind: "pdf", pdfPage: 1 });
    expect(BOOK_PAGES[PAGE_COUNT - 1]).toEqual({ kind: "back-cover" });
    expect(spreadOf(PAGE_COUNT - 1)).toEqual([PAGE_COUNT - 1]);
  });

  /**
   * The point of the arrangement: open the book at a diagram and the rule it
   * illustrates is the other half of the same spread.
   */
  it("puts every interactive page opposite the rule it illustrates", () => {
    BOOK_PAGES.forEach((page, index) => {
      if (page.kind !== "widget") return;
      const spread = spreadOf(index);
      expect(spread).toHaveLength(2);
      expect(spread).toContain(pdfPageIndex(page.facing));
    });
  });

  it("lays spreads out as page-flip does with a cover", () => {
    expect(spreadOf(0)).toEqual([0]);
    expect(spreadOf(1)).toEqual([1, 2]);
    expect(spreadOf(2)).toEqual([1, 2]);
    expect(spreadOf(3)).toEqual([3, 4]);
  });

  it("makes only the two covers hard boards", () => {
    const hard = BOOK_PAGES.map((_, i) => i).filter((i) => isHardPage(i));
    expect(hard).toEqual([0, PAGE_COUNT - 1]);
  });

  it("numbers the added pages after the page they face", () => {
    const labels = BOOK_PAGES.map(badgeLabel);
    expect(labels[4]).toBe("4A");
    expect(labels[3]).toBe("4");
    expect(labels[PAGE_COUNT - 1]).toBeNull();
  });
});

describe("pageFromQuery", () => {
  it("reads a one-based page and clamps it to the book", () => {
    expect(pageFromQuery("12")).toBe(11);
    expect(pageFromQuery("1")).toBe(0);
    expect(pageFromQuery("0")).toBe(0);
    expect(pageFromQuery("999")).toBe(PAGE_COUNT - 1);
  });

  it("opens at the cover for anything that is not a number", () => {
    expect(pageFromQuery(null)).toBe(0);
    expect(pageFromQuery("scoring")).toBe(0);
  });
});

describe("the rulebook manifest", () => {
  it("points at files that exist", () => {
    const pub = (url: string) => path.resolve(process.cwd(), "public", url.replace(/^\//, ""));
    expect(existsSync(pub(manifest.pdf))).toBe(true);
    expect(existsSync(pub(manifest.coverArt))).toBe(true);
    expect(existsSync(pub(manifest.template.src))).toBe(true);
    for (const page of manifest.pages) {
      expect(existsSync(pub(page.src))).toBe(true);
      expect(existsSync(pub(page.srcSmall))).toBe(true);
    }
  });

  it("turns every contents entry into a jump to a page in the book", () => {
    const entries = contentsEntries(toClientManifest(manifest));
    expect(entries.length).toBeGreaterThan(10);
    for (const entry of entries) expect(entry.index).toBeGreaterThan(0);
    const scoring = entries.find((entry) => entry.label.startsWith("6.3"));
    expect(scoring && BOOK_PAGES[scoring.index]).toEqual({ kind: "pdf", pdfPage: 8 });
  });

  it("keeps the text lines out of what is sent to the browser", () => {
    const client = toClientManifest(manifest);
    for (const page of client.pages) expect(page).not.toHaveProperty("lines");
  });
});
