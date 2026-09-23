/**
 * Alerts on the day site: announcements that pop up.
 *
 * An alert opens over the page the first time a visitor sees it. Once they
 * dismiss it, it moves into the thin banner across the top, and stays there
 * until an admin changes it (it pops up again, as a new version) or clears it
 * (it goes). A visitor can dismiss the pop-up, never the banner: the banner is
 * how an admin keeps something in front of everyone.
 *
 * Which version a visitor dismissed is kept in their browser, keyed by the
 * alert's id and when it was last edited. Pure, so the rules are tested.
 */

export const ALERT_TONES = ["INFO", "URGENT", "GOOD"] as const;
export type AlertTone = (typeof ALERT_TONES)[number];

export const ALERT_TONE_LABELS: Record<AlertTone, string> = {
  INFO: "Notice",
  URGENT: "Urgent",
  GOOD: "Good news",
};

export function parseTone(value: unknown): AlertTone {
  const raw = String(value ?? "").toUpperCase();
  return (ALERT_TONES as readonly string[]).includes(raw) ? (raw as AlertTone) : "INFO";
}

export interface DayAlert {
  id: string;
  title: string;
  body: string;
  tone: AlertTone;
  /** When it was last edited, in milliseconds: a new version pops up again. */
  version: number;
}

/** id -> the version the visitor dismissed. */
export type Dismissed = Record<string, number>;

export function parseDismissed(raw: string | null): Dismissed {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Dismissed = {};
    for (const [id, version] of Object.entries(value)) {
      if (typeof version === "number" && Number.isFinite(version)) out[id] = version;
    }
    return out;
  } catch {
    return {};
  }
}

/** Alerts still to pop up for this visitor: new ones, and ones edited since. */
export function pendingAlerts(alerts: DayAlert[], dismissed: Dismissed): DayAlert[] {
  return alerts.filter((alert) => dismissed[alert.id] !== alert.version);
}

/** Alerts for the banner: the ones this visitor has already seen and closed. */
export function bannerAlerts(alerts: DayAlert[], dismissed: Dismissed): DayAlert[] {
  return alerts.filter((alert) => dismissed[alert.id] === alert.version);
}

/**
 * Records a dismissal, and forgets alerts that no longer exist, so the stored
 * list never outgrows what is actually up.
 */
export function dismiss(dismissed: Dismissed, alert: DayAlert, current: DayAlert[]): Dismissed {
  const live = new Set(current.map((item) => item.id));
  const next: Dismissed = {};
  for (const [id, version] of Object.entries(dismissed)) if (live.has(id)) next[id] = version;
  next[alert.id] = alert.version;
  return next;
}

/** Urgent first, then the newest: the order they pop up in. */
export function sortAlerts(alerts: DayAlert[]): DayAlert[] {
  return [...alerts].sort(
    (a, b) => Number(b.tone === "URGENT") - Number(a.tone === "URGENT") || b.version - a.version,
  );
}
