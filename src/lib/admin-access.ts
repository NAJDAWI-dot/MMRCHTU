import { redirect } from "next/navigation";
import { requireAdmin, requireAdminApi } from "@/lib/auth";
import { canOpen, parseRoles, type AdminRole } from "@/lib/roles";

/**
 * requireAdmin, plus the role check for one screen.
 *
 * Every admin page and every admin action calls this with its own section, so
 * a hidden link is never the only thing between a scoring admin and the
 * payments ledger: the action refuses too, even when posted to by hand.
 */
export async function requireSection(section: string) {
  const admin = await requireAdmin();
  if (!canOpen(parseRoles(admin.roles), section)) redirect("/admin/no-access");
  return admin;
}

/** The API-route version: null rather than a redirect. */
export async function requireSectionApi(section: string) {
  const admin = await requireAdminApi();
  if (!admin || !canOpen(parseRoles(admin.roles), section)) return null;
  return admin;
}

export function rolesOf(admin: { roles: string }): AdminRole[] {
  return parseRoles(admin.roles);
}
