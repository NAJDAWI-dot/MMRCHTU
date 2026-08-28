import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * Ends the session in this browser.
 *
 * The origin check is what stops another site logging an admin out. The session
 * cookie is SameSite=Lax, which permits a cross-site top-level POST, so without
 * this any page could sign an admin out mid-task by submitting a form here.
 * That is a nuisance rather than a compromise — nothing is destroyed and no
 * data leaks — but it is two lines to close.
 *
 * A missing Origin is refused rather than waved through. Every browser sends it
 * on a POST, so its absence means this was not a form submission from the site,
 * and "no header" is precisely what a hand-rolled cross-site request looks like.
 */
export async function POST() {
  const incoming = headers();
  const origin = incoming.get("origin");
  const host = incoming.get("host");

  const expected = origin && host ? new URL(origin).host === host : false;
  if (!expected) {
    return new Response("Bad origin", { status: 403 });
  }

  cookies().delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
