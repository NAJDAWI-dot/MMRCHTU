/**
 * Admin roles, and which admin screens each one opens.
 *
 * Free of Prisma and of Next so the access table can be tested on its own.
 * Enforcement lives in src/lib/admin-access.ts; the sidebar and the command
 * palette read the same table, so a screen an admin cannot open is never
 * offered to them in the first place.
 *
 * Stored on AdminUser.roles as a comma-separated string, the same "plain
 * string, allowed values in code" pattern as Registration.status. An admin can
 * hold several: somebody on the registration desk in the morning and on media
 * in the afternoon needs both, not a fifth role that means "both".
 */

export const ADMIN_ROLES = ["MASTER", "REGISTRATION", "SCORING", "MEDIA", "OPERATIONS"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  MASTER: "Master",
  REGISTRATION: "Registration",
  SCORING: "Scoring",
  MEDIA: "Media",
  OPERATIONS: "Operations",
};

export const ROLE_HINTS: Record<AdminRole, string> = {
  MASTER: "Everything, including admins, page visibility and who can see the day site.",
  REGISTRATION: "Registrations, payments, ambassadors, the register form, and check-in on the day.",
  SCORING: "Qualifying runs, the bracket and match results.",
  MEDIA: "Announcements, the day guides, gallery, FAQ, committee page and email.",
  OPERATIONS: "Schedule, volunteers, competition day details and announcements.",
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

/** The roles on a row, in the canonical order, unknown words dropped. */
export function parseRoles(value: string | null | undefined): AdminRole[] {
  const words = new Set(
    String(value ?? "")
      .split(",")
      .map((word) => word.trim().toUpperCase()),
  );
  return ADMIN_ROLES.filter((role) => words.has(role));
}

export function serializeRoles(roles: Iterable<string>): string {
  return parseRoles([...roles].join(",")).join(",");
}

/** Whether these roles include any of `needed`. Master passes everything. */
export function hasAnyRole(roles: readonly AdminRole[], needed: readonly AdminRole[]): boolean {
  if (roles.includes("MASTER")) return true;
  return needed.some((role) => roles.includes(role));
}

/** Every role opens these: the dashboard and the day HQ hub. */
const EVERYONE: readonly AdminRole[] = ADMIN_ROLES;

/**
 * Which roles open which screen, by path prefix. The longest matching prefix
 * wins, so /day/hq/scoring can be stricter than /day/hq.
 *
 * Anything not listed here is Master only. A new screen added without an entry
 * is therefore shut to everybody but Master until someone decides, which is
 * the safe way round to get it wrong.
 */
export const SECTION_ROLES: Record<string, readonly AdminRole[]> = {
  "/admin": EVERYONE,
  "/admin/no-access": EVERYONE,
  "/day/hq": EVERYONE,
  "/day/hq/check-in": ["REGISTRATION"],
  "/day/hq/scoring": ["SCORING"],
  "/day/judge": ["SCORING"],
  "/day/hq/announcements": ["MEDIA", "OPERATIONS"],
  "/day/hq/guides": ["MEDIA"],
  "/day/hq/photos": ["MEDIA", "OPERATIONS"],
  "/day/hq/sponsors": ["MEDIA", "OPERATIONS"],
  "/day/hq/volunteers": ["OPERATIONS"],
  "/day/hq/access": ["MASTER"],
  "/admin/analytics": ["REGISTRATION"],
  "/admin/schedule": ["OPERATIONS"],
  "/admin/competition-day": ["OPERATIONS", "MEDIA"],
  "/admin/open-day": ["OPERATIONS", "MEDIA"],
  "/admin/micromouse": ["MEDIA"],
  "/admin/faq": ["MEDIA"],
  "/admin/gallery": ["MEDIA"],
  "/admin/team": ["MEDIA"],
  "/admin/broadcasts": ["MEDIA", "REGISTRATION"],
  "/admin/register-form": ["REGISTRATION"],
  "/admin/registrations": ["REGISTRATION"],
  "/admin/ambassadors": ["REGISTRATION"],
  "/admin/payments": ["REGISTRATION"],
  "/admin/pages": ["MASTER"],
  "/admin/admins": ["MASTER"],
  "/api/admin/teams": ["REGISTRATION"],
  "/api/registrations/export": ["REGISTRATION"],
};

/**
 * Entries that open their own page and nothing underneath. Without this the
 * dashboard's "everyone" would cover every screen under /admin that nobody
 * listed, which is exactly backwards.
 */
const EXACT_ONLY = new Set(["/admin", "/day/hq"]);

/** The roles a path needs: its longest listed prefix, else Master only. */
export function rolesForPath(pathname: string): readonly AdminRole[] {
  let best: string | null = null;
  for (const prefix of Object.keys(SECTION_ROLES)) {
    const covers =
      pathname === prefix || (!EXACT_ONLY.has(prefix) && pathname.startsWith(`${prefix}/`));
    if (covers && (best === null || prefix.length > best.length)) best = prefix;
  }
  return best === null ? ["MASTER"] : (SECTION_ROLES[best] ?? ["MASTER"]);
}

export function canOpen(roles: readonly AdminRole[], pathname: string): boolean {
  const needed = rolesForPath(pathname);
  // "Everyone" means any signed-in admin, including one not given a role yet:
  // they still need the dashboard to land on and the page saying why.
  if (needed === EVERYONE) return true;
  return hasAnyRole(roles, needed);
}
