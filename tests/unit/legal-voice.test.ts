import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_PAGES, type LegalSlug } from "@/lib/mdx";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";

/**
 * The four policy documents are written in the passive voice, and each one
 * declares that the party behind every unnamed action is IEEE RAS HTU.
 *
 * That declaration is a promise about the prose, and prose has no compiler. A
 * later edit that reintroduces "we refund you" does not fail a typecheck, a
 * build, or any other test — it just quietly makes the declaration a lie on a
 * page a team is asked to accept before paying a fee. So the one property that
 * can be checked exactly is checked here.
 *
 * What this file deliberately does NOT check is whether the prose is actually
 * passive. Telling "is verified" (passive) from "is final" (a copula) needs
 * part-of-speech tagging, and these documents are thick with both; a regex
 * approximation would flag the sentences the convention exists to protect —
 * every "you may not…" and every Code of Conduct imperative is active by
 * design. A tagger dependency to lint 400 lines of prose is a worse trade than
 * reading the diff. First person, by contrast, is a closed set with no false
 * negatives, which is the only kind of prose rule worth automating.
 *
 * The rule the documents follow, for whoever lands here after a failure:
 *
 *   Agentless passive means IEEE RAS HTU. Every other actor stays visible —
 *   as an active subject ("you", "a team", "the organizing committee") or in a
 *   `by` / `where required by` phrase.
 *
 *   1. Chapter acts            -> passivise, drop the agent.
 *   2. Reader acts             -> leave active. Never passivise a prohibition
 *                                 or an imperative; an agentless one would read
 *                                 as binding the chapter instead.
 *   3. Third party acts        -> passive WITH a `by` phrase. Never agentless.
 *   4. Nobody acts (copulas)   -> leave alone.
 *   5. Chapter acts on reader  -> passive, "you" keeps the subject slot.
 *   6. Reader acts on chapter  -> re-anchor the sentence; passivising it gives
 *                                 nonsense like "we are told by you".
 */

const slugs = Object.keys(LEGAL_PAGES) as LegalSlug[];

/**
 * Line endings are normalised, because on Windows they are not a constant.
 *
 * The files are LF in the repository, but a checkout with core.autocrlf — the
 * Windows default — hands back CRLF, and so does any round trip through `git
 * stash`. Everything below reasons about blank lines separating blocks, and
 * against CRLF a `\n\n` split silently matches nothing and returns whole files
 * instead of paragraphs. Found the hard way.
 */
function read(slug: LegalSlug): string {
  return readFileSync(path.resolve(process.cwd(), `content/legal/${slug}.mdx`), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

/**
 * The declaration paragraph, found by its lead-in rather than by line number.
 *
 * Blocks are separated by blank lines, which is what makes this reliable — and
 * is also the property the "separate blocks" test below pins down.
 */
function declarationOf(source: string): string {
  const block = source.split("\n\n").find((b) => b.includes("How this document is written"));
  if (!block) throw new Error("no declaration block");
  return block;
}

/**
 * The same block as one line, with the blockquote markers gone.
 *
 * Markdown wraps at whatever column suits the paragraph, so a name can end up
 * straddling a line break — the first version of this file did exactly that to
 * "IEEE RAS HTU" and failed. Where the assertion is about what the sentence
 * says, the wrapping is noise; where it is about the file's shape, the raw
 * block above is used instead.
 */
function declarationTextOf(source: string): string {
  return declarationOf(source)
    .replace(/^> ?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("the legal documents", () => {
  // Driven off LEGAL_PAGES rather than a hardcoded list of four, so a fifth
  // policy added to the registry is covered without anyone remembering that
  // this file exists.
  it("covers every policy the site publishes", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(4);
  });

  it("never speaks in the first person", () => {
    /*
      `\b` does the heavy lifting and has been checked against the corpus: it
      spares hours, must, status, use, abuse, website, weekend, your, yours,
      favour, honour, just, lower, newer, answered and caused. It also already
      catches we're / we'll / we've, since an apostrophe is a word boundary —
      only `let's` needs spelling out, because `us` there is not on one.
    */
    const firstPerson = /\b(we|us|our|ours|ourselves|let's)\b/i;

    const offences: string[] = [];
    for (const slug of slugs) {
      read(slug)
        .split("\n")
        // A future policy linking to /contact-us would otherwise fail on a URL
        // rather than on its prose. Only the link target is dropped; the text
        // in the brackets is prose and still gets checked.
        .map((line) => line.replace(/\]\([^)]*\)/g, "]"))
        .forEach((line, i) => {
          if (firstPerson.test(line)) offences.push(`${slug}.mdx:${i + 1}: ${line.trim()}`);
        });
    }

    // Collected rather than asserted line by line so a failure names the lines,
    // instead of only the first one and only the file it was in.
    expect(offences).toEqual([]);
  });

  it("tells every reader who the passive voice is hiding", () => {
    for (const slug of slugs) {
      const declaration = declarationTextOf(read(slug));
      expect(declaration).toContain("IEEE Robotics and Automation Society, HTU Student Chapter");
      expect(declaration).toContain("IEEE RAS HTU");
    }
  });

  /**
   * The declaration is repeated in all four files rather than rendered once by
   * the route, so that a document copied out or printed still carries it. Drift
   * is the price of that choice, and this is what pays it.
   */
  it("declares itself in the same words on every page", () => {
    const variants = new Set(slugs.map((slug) => declarationOf(read(slug))));
    expect(variants.size).toBe(1);
  });

  /**
   * Two blockquotes separated by a blank line render as two elements; without
   * the blank line they collapse into one, and the declaration would be read as
   * part of the draft banner — which is scaffolding due to be deleted before
   * launch, and would take the declaration with it.
   */
  it("keeps the declaration clear of the draft banner", () => {
    for (const slug of slugs) {
      expect(read(slug)).toMatch(
        /\*\*Draft — pending review\.\*\*[\s\S]*?\n\n> \*\*How this document is written\.\*\*/,
      );
    }
  });

  it("carries one date across all four, since all four were rewritten at once", () => {
    const dates = new Set(slugs.map((slug) => /Last updated .*/.exec(read(slug))?.[0]));
    expect(dates.size).toBe(1);
  });

  /**
   * Pinned to the constant rather than to a literal: the refund page promises a
   * verification window that the payment screens quote from code, and an editor
   * normalising the en dash to a hyphen would silently part them.
   */
  it("promises the same verification window the payment screens do", () => {
    expect(read("payment-refund-policy")).toContain(VERIFICATION_WINDOW_TEXT);
  });
});
