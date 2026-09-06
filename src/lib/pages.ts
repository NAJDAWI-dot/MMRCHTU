/**
 * The public pages an admin can hide, and the path arithmetic around them.
 *
 * Free of Prisma and of Next: everything here is a pure function over a list of
 * hrefs, so the interesting cases — a hidden parent covering its children, an
 * href that is a prefix of another but not a parent of it — are testable
 * without a database or a request.
 *
 * Reads live in src/lib/page-visibility.ts; this is only the vocabulary.
 */

export interface ManagedPage {
  /** The path, exactly as it appears in the site menu. */
  href: string;
  /** What the admin panel calls it. Matches the menu label. */
  label: string;
  /** What disappears when it is hidden, including anything underneath it. */
  covers: string;
}

/**
 * Every page the admin panel offers a switch for.
 *
 * The homepage is deliberately absent. Hiding it would leave visitors landing
 * on a 404 with no menu to escape from, which is not a state anyone means to
 * put the site in — and "take the whole site down" is a deploy decision, not a
 * toggle in a page list.
 *
 * The order here is the order of the site menu, so the admin panel reads as
 * the menu it controls rather than as an unrelated list.
 */
export const MANAGED_PAGES: readonly ManagedPage[] = [
  { href: "/game", label: "Pac Mouse", covers: "The game and its leaderboard." },
  { href: "/rules", label: "Rules", covers: "The rulebook and the readiness checklist under it." },
  { href: "/schedule", label: "Schedule", covers: "The published run of dates." },
  {
    href: "/competition-day",
    label: "Competition Day",
    covers: "The day page. Its own status can already hide it; this hides it either way.",
  },
  {
    href: "/gallery",
    label: "Gallery",
    covers: "The album index and every album page. Hidden on its own while no album is published.",
  },
  {
    href: "/team",
    label: "Team",
    covers: "The committee page. Hidden on its own until somebody on it is published.",
  },
  { href: "/faq", label: "FAQ", covers: "Published answers and the ask-a-question form." },
  {
    href: "/register",
    label: "Register",
    covers: "The whole registration flow. Closing registration is a separate switch on Register Form.",
  },
] as const;

/**
 * Whether an href is one this system is allowed to act on.
 *
 * The guard on the admin action: the href arrives from a form field, and
 * without this an edited request could write a visibility row for any path at
 * all — including "/" — and hide a page nobody can then find a switch for.
 */
export function isManagedPage(href: string): boolean {
  return MANAGED_PAGES.some((page) => page.href === href);
}

export function findManagedPage(href: string): ManagedPage | undefined {
  return MANAGED_PAGES.find((page) => page.href === href);
}

/**
 * Whether hiding `href` also hides `pathname`.
 *
 * The "/" is what makes this correct rather than nearly correct: a plain
 * `startsWith` would have "/rules" cover "/rules-archive", which is a different
 * page that nobody asked to hide.
 */
export function coversPath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether any of the hidden hrefs covers this path. */
export function isPathHidden(pathname: string, hiddenHrefs: Iterable<string>): boolean {
  for (const href of hiddenHrefs) {
    if (coversPath(href, pathname)) return true;
  }
  return false;
}
