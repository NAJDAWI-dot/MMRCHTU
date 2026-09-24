import { draftMode } from "next/headers";
import { requireAdminApi } from "@/lib/auth";
import { dayTarget } from "@/lib/day-links";

/**
 * Opens the day site for a signed-in admin: ?to=/day/screen, or /day.
 *
 * While the day site is private it only renders inside draft mode, which
 * signing in turns on. But draft mode is keyed to the build, so every deploy
 * quietly switches it off for anyone already signed in: Day HQ still works on
 * the session, and every /day page says "not found". Each Day HQ link to the
 * day site comes through here, which checks the session and turns draft mode
 * back on first, so a deploy never locks the staff out mid-competition.
 */
export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return go("/admin/login");

  draftMode().enable();
  // Only somewhere on the day site, never a full URL: this is not a redirector.
  return go(dayTarget(new URL(request.url).searchParams.get("to")));
}

/**
 * A redirect to a path on this site. Relative on purpose: behind a proxy the
 * request's own URL can carry the server's internal address, not the site's.
 */
function go(path: string) {
  return new Response(null, { status: 307, headers: { Location: path, "Cache-Control": "no-store" } });
}
