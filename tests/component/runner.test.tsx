import { readFileSync } from "node:fs";
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Runner } from "@/components/brand/Runner";

/**
 * The runner who chases Cheddar along the bottom of the screen.
 *
 * He is a static drawing, so there is little behaviour to test — but there is
 * one join that can come apart silently, and it is the reason this file exists.
 *
 * Each limb turns about a joint whose coordinates live in globals.css, written
 * in the drawing's own units and matched to the class on the group. Rename a
 * class, or move a shoulder in the drawing without moving its transform-origin,
 * and nothing throws: the limb simply pivots about some other point — about the
 * corner of the viewBox if the rule stops matching at all — and an arm swings
 * clean off the body. That is invisible to a typecheck, invisible to a build,
 * and only shows up as a mangled figure sliding past the footer.
 *
 * So this asserts the two halves still agree.
 */

afterEach(cleanup);

const css = readFileSync("src/app/globals.css", "utf8");

function svg(): SVGSVGElement {
  const { container } = render(<Runner />);
  const element = container.querySelector("svg");
  if (!element) throw new Error("Runner rendered no svg");
  return element as SVGSVGElement;
}

/** Every `.runner-*` class the stylesheet gives a transform-origin to. */
function pivotedClassesInCss(): Map<string, string> {
  const found = new Map<string, string>();
  const rule = /\.(runner-[\w-]+)\s*\{([^}]*)\}/g;
  for (const match of css.matchAll(rule)) {
    const className = match[1]!;
    const origin = /transform-origin:\s*([^;]+);/.exec(match[2]!);
    if (origin) found.set(className, origin[1]!.trim());
  }
  return found;
}

describe("Runner", () => {
  it("is decoration, and says so", () => {
    // He sits in an aria-hidden layer already, but a drawing that announced
    // itself to a screen reader if it were ever used elsewhere would be noise:
    // there is nothing here a listener needs.
    expect(svg().getAttribute("aria-hidden")).toBe("true");
    expect(svg().getAttribute("focusable")).toBe("false");
  });

  it("keeps the className it is given, so the chase can size him", () => {
    const { container } = render(<Runner className="ambient-runner" />);
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("ambient-runner");
  });

  it("draws every limb the stylesheet expects to pivot", () => {
    const pivoted = pivotedClassesInCss();

    // A guard on the guard: if the selectors are ever renamed wholesale this
    // would otherwise pass by finding nothing to check.
    expect(pivoted.size).toBeGreaterThanOrEqual(4);

    for (const className of pivoted.keys()) {
      expect(
        svg().querySelector(`.${className}`),
        `globals.css pivots .${className}, but Runner.tsx draws no such group`,
      ).not.toBeNull();
    }
  });

  it("pivots each limb about a joint that is actually on the drawing", () => {
    /*
      A transform-origin of, say, `33px 88px` only means the shoulder if the
      shoulder is drawn at (33, 88). Rather than restate the coordinates here —
      which would just be the same numbers twice — check that each origin falls
      inside the viewBox and inside the limb's own bounding box, which is what
      "on the joint" amounts to and what a stray edit would break.
    */
    const [, , width, height] = svg().getAttribute("viewBox")!.split(/\s+/).map(Number);

    for (const [className, origin] of pivotedClassesInCss()) {
      const [x, y] = origin.split(/\s+/).map((part) => Number.parseFloat(part));
      expect(Number.isFinite(x) && Number.isFinite(y), `${className}: ${origin}`).toBe(true);
      expect(x, `${className} pivots outside the drawing`).toBeGreaterThan(0);
      expect(x, `${className} pivots outside the drawing`).toBeLessThan(width!);
      expect(y, `${className} pivots outside the drawing`).toBeGreaterThan(0);
      expect(y, `${className} pivots outside the drawing`).toBeLessThan(height!);
    }
  });

  it("draws the shirt, which is what makes him recognisable at all", () => {
    // At the size he runs past — around a hundred pixels — the face is a few
    // dozen pixels across and the red of the kit is the first thing read. A
    // silent loss of the fill would leave an anonymous figure.
    expect(svg().innerHTML).toContain("#c40d1c");
  });
});
