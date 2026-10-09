/**
 * Wrap-up: the switch that turns mmrchtu.tech into the site of a competition
 * that has happened. The homepage becomes a thank-you with the results, day
 * mode stops hiding the rulebook, and registration goes dark.
 *
 * Free of Prisma and of Next, like src/lib/day-mode.ts, so what the switch
 * hides can be tested on its own. The reads live in src/lib/page-visibility.ts.
 */

/** Pages that go dark once the competition is over: there is nothing left to sign up for. */
export const WRAP_UP_HIDDEN_PAGES = ["/register"] as const;

/**
 * Menu entries that step aside without their pages going dark. They describe
 * a day that has been and gone; Results and the journey take their place.
 */
export const WRAP_UP_MENU_OMITS = ["/competition-day", "/open-day", "/schedule"] as const;

/** The hidden-page set, with wrap-up's pages added while it is on. A new set, as in withDayMode. */
export function withWrapUp(hidden: Iterable<string>, on: boolean): Set<string> {
  const next = new Set(hidden);
  if (on) for (const href of WRAP_UP_HIDDEN_PAGES) next.add(href);
  return next;
}

/** Every href wrap-up takes out of the menu. */
export function wrapUpMenuHidden(on: boolean): string[] {
  return on ? [...WRAP_UP_HIDDEN_PAGES, ...WRAP_UP_MENU_OMITS] : [];
}

export const DEVELOPER_NAME = "Hashem Najdawi";
export const DEVELOPER_ROLE = "Designed and built the MMRC 26 website";
export const DEVELOPER_LINKEDIN = "https://www.linkedin.com/in/hashemnajdawi/";

/** Room for a proper letter, short of an essay. */
export const DEVELOPER_MESSAGE_MAX = 2000;

/**
 * The message shown until one is written on the Access desk. Plain words, in
 * the developer's own voice, and meant to be replaced.
 */
export const DEFAULT_DEVELOPER_MESSAGE = [
  "I built this website for MMRC 26, from the first registration to the last run of the final.",
  "It started as a place to sign up. Over the months it picked up a rulebook you can flip through, a maze game, a maze generator, an open day stand and, on the day itself, a live site with a call queue, a hall screen, judge tablets and a bracket that filled in as the matches were played.",
  "Thank you to the committee for trusting me with it, to every team that registered and kept checking back, and to everyone who sent me a bug or an idea. A lot of what you see here started as one of them.",
  "See you at MMRC 27.",
].join("\n\n");

/** A message as it will be stored: blank-line paragraphs, trimmed, capped. Empty means "use the default". */
export function parseDeveloperMessage(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, DEVELOPER_MESSAGE_MAX)
    .trim();
}

/** The message's paragraphs, the stored one or the default. */
export function messageParagraphs(stored: string): string[] {
  const message = parseDeveloperMessage(stored) || DEFAULT_DEVELOPER_MESSAGE;
  return message.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

/**
 * The website itself, in numbers, as it stood when the competition ended.
 * Counted from the repository on 9 October 2026; written down rather than
 * counted live, because a page should not run git.
 */
export const BUILD_STATS = [
  { value: 203, label: "commits" },
  { value: 47, label: "pull requests" },
  { value: 67, label: "pages" },
  { value: 65_000, label: "lines of code", approx: true },
] as const;

/** When the first line was written. */
export const BUILD_STARTED = "July 2026";
