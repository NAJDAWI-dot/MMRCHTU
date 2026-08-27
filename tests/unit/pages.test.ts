import { describe, expect, it } from "vitest";
import {
  MANAGED_PAGES,
  coversPath,
  findManagedPage,
  isManagedPage,
  isPathHidden,
} from "@/lib/pages";

describe("MANAGED_PAGES", () => {
  it("never offers a switch for the homepage", () => {
    // Hiding "/" would strand every visitor on a 404 with no menu to leave by.
    expect(isManagedPage("/")).toBe(false);
  });

  it("lists each page once, under a path that is absolute", () => {
    const hrefs = MANAGED_PAGES.map((page) => page.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
  });

  it("gives every page a label and a description of what goes with it", () => {
    expect(MANAGED_PAGES.every((page) => page.label.length > 0 && page.covers.length > 0)).toBe(
      true,
    );
  });

  it("carries no trailing slashes, which coversPath would double up", () => {
    expect(MANAGED_PAGES.every((page) => !page.href.endsWith("/"))).toBe(true);
  });
});

describe("isManagedPage", () => {
  it("accepts a page on the list", () => {
    expect(isManagedPage("/rules")).toBe(true);
  });

  it("rejects anything else, including admin paths and near-misses", () => {
    // This is the guard on the admin action, so a rejection here is the thing
    // stopping a hand-edited form from hiding an arbitrary path.
    expect(isManagedPage("/admin/pages")).toBe(false);
    expect(isManagedPage("/rules/")).toBe(false);
    expect(isManagedPage("/rules/checklist")).toBe(false);
    expect(isManagedPage("")).toBe(false);
  });
});

describe("findManagedPage", () => {
  it("returns the entry for a known href", () => {
    expect(findManagedPage("/gallery")?.label).toBe("Gallery");
  });

  it("returns undefined rather than throwing for an unknown one", () => {
    expect(findManagedPage("/nope")).toBeUndefined();
  });
});

describe("coversPath", () => {
  it("covers the page itself", () => {
    expect(coversPath("/rules", "/rules")).toBe(true);
  });

  it("covers everything nested under it", () => {
    // Hiding /gallery has to take the album pages with it, or "hidden" means
    // only that the index is gone while every album stays live at its own URL.
    expect(coversPath("/gallery", "/gallery/finals")).toBe(true);
    expect(coversPath("/rules", "/rules/checklist")).toBe(true);
  });

  it("does not cover a sibling that merely starts with the same characters", () => {
    expect(coversPath("/rules", "/rules-archive")).toBe(false);
    expect(coversPath("/game", "/gamejam")).toBe(false);
  });

  it("does not cover a parent", () => {
    expect(coversPath("/gallery/finals", "/gallery")).toBe(false);
  });
});

describe("isPathHidden", () => {
  it("is false when nothing is hidden", () => {
    expect(isPathHidden("/rules", [])).toBe(false);
  });

  it("is true when any hidden href covers the path", () => {
    expect(isPathHidden("/gallery/finals", ["/faq", "/gallery"])).toBe(true);
  });

  it("is false for a path no hidden href covers", () => {
    expect(isPathHidden("/schedule", ["/faq", "/gallery"])).toBe(false);
  });

  it("accepts a Set, which is what the database read hands it", () => {
    expect(isPathHidden("/faq", new Set(["/faq"]))).toBe(true);
  });
});
