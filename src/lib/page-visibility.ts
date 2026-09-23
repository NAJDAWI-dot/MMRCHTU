import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionSignature } from "@/lib/auth";
import { withDayMode } from "@/lib/day-mode";

/**
 * Reading admin-controlled page visibility, and enforcing it.
 *
 * The pure half — which page covers which path — lives in @/lib/pages and is
 * tested there. This is the half that touches the database and the request.
 */

/**
 * Every href an admin has switched off.
 *
 * Wrapped in React's `cache` so the site menu and the guard on the page being
 * rendered share one query per request rather than issuing one each. The list
 * is a handful of short strings, so fetching all of them and testing in memory
 * beats a query per page.
 */
export const hiddenPageHrefs = cache(async (): Promise<Set<string>> => {
  const [rows, day] = await Promise.all([
    prisma.pageVisibility.findMany({
      where: { isHidden: true },
      select: { href: true },
    }),
    dayModeOn(),
  ]);
  // Day mode's pages join the set here, once, so the menu, the homepage cards
  // and the guard on each page all follow the switch without any of them
  // having to know it exists. The Pages tab reads its own rows directly, so
  // an admin's own switches there are left exactly as they set them.
  return withDayMode(
    rows.map((row) => row.href),
    day,
  );
});

/**
 * Whether the site is in competition day mode.
 *
 * A read of one boolean off a singleton row, cached per request like the set
 * above. No row yet means the schema default, which is off.
 */
export const dayModeOn = cache(async (): Promise<boolean> => {
  const row = await prisma.competitionDayConfig.findUnique({
    where: { id: "singleton" },
    select: { dayMode: true },
  });
  return row?.dayMode ?? false;
});

/**
 * Whether the person asking is a signed-in admin.
 *
 * Signature-only, with no database round trip: this decides whether to show a
 * hidden page to the person who hid it, not whether to trust anyone with
 * anything. Every actual admin capability still goes through requireAdmin(),
 * which additionally confirms the AdminUser row still exists.
 *
 * Reading cookies makes the render dynamic, which is why it is called only once
 * a page is already known to be hidden, and then only inside draft mode (see
 * guardHiddenPage) — a visible page stays statically revalidated exactly as
 * before. Dynamic routes such as the day preview may call it directly.
 */
export async function viewerIsAdmin(): Promise<boolean> {
  try {
    return verifySessionSignature(cookies().get(SESSION_COOKIE_NAME)?.value) !== null;
  } catch {
    // cookies() throws when there is no request behind the render — during
    // `next build`, for one. No request means no admin.
    return false;
  }
}

/**
 * 404s a hidden page, unless an admin is looking at it.
 *
 * Called from a layout rather than a page so that everything underneath the
 * route goes with it: hiding /gallery has to take /gallery/finals with it, or
 * "hidden" means only that the index is gone while every album stays live at a
 * URL that is still in Google.
 *
 * notFound() rather than a redirect or a "come back later" page: a hidden page
 * should be indistinguishable from one that was never published, and a bespoke
 * placeholder is a second page to design, translate and keep accurate.
 */
export async function guardHiddenPage(href: string): Promise<void> {
  const hidden = await hiddenPageHrefs();
  if (!hidden.has(href)) return;
  // Draft mode first, and the cookie only inside it. Most hideable pages are
  // built static, and a static page that reads cookies at runtime is a 500
  // for everyone ("Page changed from static to dynamic at runtime"), which is
  // what hiding a page after a deploy used to produce. Admin login turns draft
  // mode on for that browser, which renders pages fresh for it and makes the
  // cookie read legal; every other visitor gets the cached "not found".
  if (draftMode().isEnabled && (await viewerIsAdmin())) return;
  notFound();
}
