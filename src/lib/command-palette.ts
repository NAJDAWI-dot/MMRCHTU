/**
 * Ranking for the admin command palette.
 *
 * Pure and free of React so the interesting part — which of twelve
 * near-identical admin pages a two-letter query should offer first — can be
 * tested without a keyboard, a router or a DOM.
 *
 * The scoring is deliberately coarse. A palette over a fixed set of a dozen
 * destinations does not need a real fuzzy matcher; it needs "pay" to put
 * Payments first and "reg" to put Registrations above Register Form, and to
 * never rank a subsequence oddity above a plain prefix.
 */

export type CommandGroup = "Pages" | "Teams" | "Actions";

export interface Command {
  /** Stable across renders; used as the React key and the aria-activedescendant target. */
  id: string;
  label: string;
  href: string;
  group: CommandGroup;
  /** The quieter second line — an email address, a destination, a hint. */
  hint?: string;
  /** Extra words that should match, never shown. */
  keywords?: string;
}

const EXACT = 120;
const LABEL_PREFIX = 100;
const WORD_PREFIX = 80;
const LABEL_CONTAINS = 60;
const KEYWORD = 40;
const SUBSEQUENCE = 20;

/**
 * Every character of `query`, in order, somewhere in `text`.
 *
 * This is what lets "cmpday" find Competition Day. Ranked last on purpose: a
 * subsequence match is nearly always true of something, so it belongs below
 * every literal match rather than competing with them.
 */
export function isSubsequence(text: string, query: string): boolean {
  let at = 0;
  for (const char of text) {
    if (char === query[at]) at += 1;
    if (at === query.length) return true;
  }
  return query.length === 0;
}

/** How well one command answers a query, or null if it does not at all. */
export function scoreCommand(command: Command, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const label = command.label.toLowerCase();
  const keywords = (command.keywords ?? "").toLowerCase();
  const hint = (command.hint ?? "").toLowerCase();

  if (label === q) return EXACT;
  if (label.startsWith(q)) return LABEL_PREFIX;
  if (label.split(/\s+/).some((word) => word.startsWith(q))) return WORD_PREFIX;
  if (label.includes(q)) return LABEL_CONTAINS;
  // The hint carries a team's email address, which is often the only thing an
  // admin has to hand when a payment lands with no team name on it.
  if (keywords.includes(q) || hint.includes(q)) return KEYWORD;
  if (isSubsequence(label, q)) return SUBSEQUENCE;

  return null;
}

/**
 * The commands worth offering for a query, best first.
 *
 * An empty query returns everything in the order it was given, so opening the
 * palette and typing nothing shows the sidebar's own menu rather than an
 * arbitrary reshuffle. Ties keep their original order too — `sort` is stable,
 * and the input order is meaningful here.
 */
export function rankCommands<T extends Command>(commands: readonly T[], query: string): T[] {
  const scored: Array<{ command: T; score: number }> = [];

  for (const command of commands) {
    const score = scoreCommand(command, query);
    if (score !== null) scored.push({ command, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.command);
}

/**
 * Wraps an index around the ends of a list.
 *
 * Arrow-down on the last result goes back to the first, which is what every
 * palette does and what the hand expects when it is holding the key down.
 * Returns -1 for an empty list so callers have nothing selected rather than
 * a phantom row 0.
 */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  return ((index % length) + length) % length;
}
