/**
 * Competition day page rules. SQLite has no enums, so CompetitionDayConfig.status
 * is a plain String constrained here (same pattern as BroadcastList.kind in
 * src/lib/broadcast.ts).
 */

export const COMPETITION_DAY_STATUSES = ["HIDDEN", "COMING_SOON", "PUBLISHED"] as const;
export type CompetitionDayStatus = (typeof COMPETITION_DAY_STATUSES)[number];

export const COMPETITION_DAY_STATUS_LABELS: Record<CompetitionDayStatus, string> = {
  HIDDEN: "Hidden",
  COMING_SOON: "Coming soon",
  PUBLISHED: "Published",
};

export const COMPETITION_DAY_STATUS_HINTS: Record<CompetitionDayStatus, string> = {
  HIDDEN: "The page returns “not found” and its link is removed from the site menu.",
  COMING_SOON: "The page is live but shows only the holding message — the details below stay private.",
  PUBLISHED: "The page shows the date, venue, and details below.",
};

export function isCompetitionDayStatus(value: string): value is CompetitionDayStatus {
  return (COMPETITION_DAY_STATUSES as readonly string[]).includes(value);
}

export function parseStatus(value: unknown): CompetitionDayStatus {
  const raw = String(value ?? "").toUpperCase();
  return isCompetitionDayStatus(raw) ? raw : "COMING_SOON";
}

/**
 * Splits admin-authored plain text into paragraphs on blank lines. The result is
 * rendered as React children (never dangerouslySetInnerHTML), so the text is
 * escaped for us and an admin cannot inject markup into the public page.
 */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
