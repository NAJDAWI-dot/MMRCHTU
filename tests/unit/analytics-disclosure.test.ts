import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Measurement and its disclosure, tied together.
 *
 * The privacy policy tells a visitor that page views are counted, by whom, and
 * that no cookie is involved. That sentence is only true while the script it
 * describes is the one actually on the page — and both halves are easy to move
 * alone. Someone switching analytics off leaves the policy claiming a thing
 * that no longer happens; someone switching a different one on leaves it
 * describing the wrong one.
 *
 * So the two are asserted to agree rather than each being checked on its own.
 * A deliberate change to either simply changes both, which is the point.
 */

const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("page-view measurement", () => {
  it("is disclosed in the privacy policy exactly when it is switched on", () => {
    const measured = read("src/app/layout.tsx").includes("/_vercel/insights/script.js");
    const disclosed = /vercel web analytics/i.test(read("content/legal/privacy.mdx"));

    expect(disclosed).toBe(measured);
  });

  it("is named in the list of who else sees your data", () => {
    // Vercel is already there as the host. The point of the entry is what it
    // is used for, and counting page views is a use a reader would not guess
    // from "hosts the website".
    expect(read("content/legal/privacy.mdx")).toMatch(/\*\*Vercel\*\*[\s\S]{0,200}counts page views/i);
  });

  it("still promises no cookies, which is why the endpoint may be used at all", () => {
    // Vercel Web Analytics is cookieless. If that ever stopped being true the
    // policy would be wrong in the one place people check first, so the claim
    // is pinned here next to the thing that has to keep honouring it.
    expect(read("content/legal/privacy.mdx")).toMatch(/no cookie is set on the public pages/i);
  });
});
