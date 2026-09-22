import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionSignature } from "@/lib/auth";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { parseRoles } from "@/lib/roles";

/**
 * Who can open the day site under /day.
 *
 * PRIVATE: only the admins named in dayViewerIds, or every Master while nobody
 * is named. STAFF: any signed-in admin. PUBLIC: everyone, and the homepage
 * hands over to it.
 *
 * Checked the same way hidden pages are (see guardHiddenPage): the public
 * answer needs no cookie, so a public day site stays cached; anything less
 * than public is only ever let through inside draft mode, which admin sign-in
 * turns on, and everybody else gets the cached "not found".
 */

export const DAY_AUDIENCES = ["PRIVATE", "STAFF", "PUBLIC"] as const;
export type DayAudience = (typeof DAY_AUDIENCES)[number];

export const DAY_AUDIENCE_LABELS: Record<DayAudience, string> = {
  PRIVATE: "Only the admins you pick",
  STAFF: "Every admin",
  PUBLIC: "Everyone",
};

export const DAY_AUDIENCE_HINTS: Record<DayAudience, string> = {
  PRIVATE: "Nobody else can open it. Visitors get “not found” and the normal homepage.",
  STAFF: "Any signed-in admin can open it, so the whole team can check it before the day.",
  PUBLIC: "mmrchtu.tech opens on the day site, and Register and Rules are hidden.",
};

export function parseAudience(value: unknown): DayAudience {
  const raw = String(value ?? "").toUpperCase();
  return (DAY_AUDIENCES as readonly string[]).includes(raw) ? (raw as DayAudience) : "PRIVATE";
}

export function parseViewerIds(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Whether this request may see the day site.
 *
 * Cached per request, so the layout and each page can ask without a second
 * round of queries.
 */
export const canViewDaySite = cache(async (): Promise<boolean> => {
  const config = await getCompetitionDayConfig();
  const audience = parseAudience(config.dayAudience);
  if (audience === "PUBLIC") return true;

  if (!draftMode().isEnabled) return false;

  let session: ReturnType<typeof verifySessionSignature> = null;
  try {
    session = verifySessionSignature(cookies().get(SESSION_COOKIE_NAME)?.value);
  } catch {
    return false;
  }
  if (!session) return false;

  // The row, not only the signature: a revoked session or a deleted account
  // must not keep a private preview open.
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, roles: true, tokenVersion: true },
  });
  if (!admin || admin.tokenVersion !== session.tokenVersion) return false;

  if (audience === "STAFF") return true;
  const viewers = parseViewerIds(config.dayViewerIds);
  if (viewers.length === 0) return parseRoles(admin.roles).includes("MASTER");
  return viewers.includes(admin.id);
});

/** Whether the day site is open to everyone. Reads no cookie. */
export async function daySiteIsPublic(): Promise<boolean> {
  const config = await getCompetitionDayConfig();
  return parseAudience(config.dayAudience) === "PUBLIC";
}
