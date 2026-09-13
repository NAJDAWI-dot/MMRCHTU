import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_PAGES, type LegalSlug } from "@/lib/mdx";
import { CONSENT_VERSION } from "@/lib/registration";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";

/**
 * The four policy documents speak in the first person, and each opens by
 * saying who "we" is: IEEE RAS HTU. A team accepts these pages before paying a
 * fee, so that definition has to be there, and worded the same, on every one.
 */

const slugs = Object.keys(LEGAL_PAGES) as LegalSlug[];

/** Windows checkouts can hand back CRLF, and the block logic splits on blank lines. */
function read(slug: LegalSlug): string {
  return readFileSync(path.resolve(process.cwd(), `content/legal/${slug}.mdx`), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function definitionOf(source: string): string {
  const block = source.split("\n\n").find((b) => b.includes('Who "we" are'));
  if (!block) throw new Error("no definition block");
  return block;
}

describe("the legal documents", () => {
  // Driven off LEGAL_PAGES so a fifth policy is covered automatically.
  it("covers every policy the site publishes", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(4);
  });

  it("says who \"we\" means", () => {
    for (const slug of slugs) {
      const definition = definitionOf(read(slug)).replace(/^> ?/gm, "").replace(/\s+/g, " ");
      expect(definition).toContain("IEEE Robotics and Automation Society, HTU Student Chapter");
      expect(definition).toContain("IEEE RAS HTU");
    }
  });

  it("defines it in the same words on every page", () => {
    const variants = new Set(slugs.map((slug) => definitionOf(read(slug))));
    expect(variants.size).toBe(1);
  });

  it("carries no draft scaffolding", () => {
    const offences: string[] = [];
    for (const slug of slugs) {
      const source = read(slug);
      if (/pending review/i.test(source)) offences.push(`${slug}.mdx: "pending review"`);
      if (/\*\*Draft\b/i.test(source)) offences.push(`${slug}.mdx: a **Draft** banner`);
    }
    expect(offences).toEqual([]);
  });

  it("opens every document with the definition, as a block of its own", () => {
    for (const slug of slugs) {
      const first = read(slug).split("\n\n")[0] ?? "";
      expect(first.startsWith('> **Who "we" are.**')).toBe(true);
      expect(first.split("\n").every((line) => line.startsWith(">"))).toBe(true);
    }
  });

  it("carries one date across all four", () => {
    const dates = new Set(slugs.map((slug) => /Last updated .*/.exec(read(slug))?.[0]));
    expect(dates.size).toBe(1);
  });

  /**
   * A registration stores CONSENT_VERSION, and that value only means something
   * if it matches the date of the wording on the page that day.
   */
  it("is dated the day CONSENT_VERSION records", () => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    const match = /Last updated (\d{1,2}) (\w+) (\d{4})\./.exec(read("terms"));
    if (!match) throw new Error("terms.mdx has no 'Last updated' line");

    const [, day, month, year] = match;
    if (!day || !month || !year) throw new Error("unreadable date line in terms.mdx");

    const monthNumber = months.indexOf(month) + 1;
    expect(monthNumber).toBeGreaterThan(0);

    const iso = `${year}-${String(monthNumber).padStart(2, "0")}-${day.padStart(2, "0")}`;
    expect(iso).toBe(CONSENT_VERSION);
  });

  // The refund page promises the same verification window the payment screens quote.
  it("promises the same verification window the payment screens do", () => {
    expect(read("payment-refund-policy")).toContain(VERIFICATION_WINDOW_TEXT);
  });
});
