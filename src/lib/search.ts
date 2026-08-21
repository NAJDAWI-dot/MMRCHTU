/**
 * Search across the rulebook and the FAQ.
 *
 * Both are small — a few dozen short documents — so this ranks them in memory
 * on each request rather than building an index. That keeps the whole feature
 * to one file with no dependency and no build step, and at this size the
 * difference is unmeasurable. If the corpus ever grows past a few hundred
 * documents, this is the piece to replace.
 *
 * Free of React, the DOM and the database: the documents are passed in, so the
 * ranking can be tested directly.
 */

export type SearchKind = "rule" | "faq";

export interface SearchDoc {
  id: string;
  title: string;
  body: string;
  href: string;
  kind: SearchKind;
}

export interface SearchHit extends SearchDoc {
  score: number;
  /** A window of the body around the first match. */
  snippet: string;
}

/**
 * Splits a query into searchable terms.
 *
 * Single characters are dropped: they match almost everything and rank it all
 * equally, which is worse than no results.
 */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length > 1);
}

/** Occurrences of `term` in `text`, matched case-insensitively. */
function count(text: string, term: string): number {
  let n = 0;
  let from = 0;
  const haystack = text.toLowerCase();
  for (;;) {
    const found = haystack.indexOf(term, from);
    if (found === -1) return n;
    n++;
    from = found + term.length;
  }
}

/**
 * A window of text around the first matching term.
 *
 * Falls back to the opening of the body when nothing matches, so a result can
 * never render as an empty line.
 */
export function snippet(body: string, terms: string[], length = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";

  const lower = flat.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }

  if (at === -1 || flat.length <= length) {
    return flat.length <= length ? flat : `${flat.slice(0, length).trimEnd()}…`;
  }

  // Centre the window on the match rather than starting at it, so the reader
  // gets the words leading up to their term as well as those following it.
  const start = Math.max(0, at - Math.floor(length / 3));
  const end = Math.min(flat.length, start + length);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/**
 * Ranks documents against a query.
 *
 * A title match counts for far more than a body match: someone typing
 * "footprint" wants the rule called that, not every paragraph mentioning it.
 * Documents matching none of the terms are dropped rather than ranked last —
 * a page of irrelevant results reads as a broken search.
 */
export function search(docs: SearchDoc[], query: string, limit = 20): SearchHit[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const hits: SearchHit[] = [];

  for (const doc of docs) {
    let score = 0;
    let matched = false;

    for (const term of terms) {
      const inTitle = count(doc.title, term);
      const inBody = count(doc.body, term);
      if (inTitle || inBody) matched = true;
      score += inTitle * 8 + inBody;
    }

    if (!matched) continue;

    // Every term present beats one term repeated: "speed run" should rank a
    // document containing both above one that says "speed" five times.
    const complete = terms.every(
      (term) => count(doc.title, term) > 0 || count(doc.body, term) > 0,
    );
    if (complete) score += 10 * terms.length;

    hits.push({ ...doc, score, snippet: snippet(doc.body, terms) });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export interface HighlightPart {
  text: string;
  hit: boolean;
}

/**
 * Splits text into matched and unmatched runs, so a result can emphasise the
 * words the visitor typed without the page building HTML from a string.
 */
export function highlight(text: string, terms: string[]): HighlightPart[] {
  if (!terms.length || !text) return [{ text, hit: false }];

  // Longest first, so "speed run" wins over "speed" where both would match.
  const ordered = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${ordered.map(escapeRegExp).join("|")})`, "gi");

  return text
    .split(pattern)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, hit: ordered.some((t) => t === part.toLowerCase()) }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turns the rulebook's MDX source into searchable sections.
 *
 * Split on the `##` headings so a hit points at a rule rather than at "the
 * rulebook", and stripped of the things that are markup rather than content:
 * the embedded diagram components, and the emphasis characters that would
 * otherwise show up inside snippets.
 */
export function rulebookSections(mdx: string): SearchDoc[] {
  const parts = mdx.split(/^##\s+/m).slice(1);

  return parts.map((part, index) => {
    const newline = part.indexOf("\n");
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    const body = (newline === -1 ? "" : part.slice(newline + 1))
      // Self-closing JSX components: the live diagrams.
      .replace(/<[A-Z][^>]*\/>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[*_`]/g, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .trim();

    return { id: `rule-${index}`, title, body, href: "/rules", kind: "rule" as const };
  });
}
