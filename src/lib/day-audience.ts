/**
 * The day site's audience settings, as plain values.
 *
 * Kept apart from src/lib/day-access.ts, which reads cookies and the database,
 * so the Access form in the browser can use the labels without pulling server
 * code into the client bundle.
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
