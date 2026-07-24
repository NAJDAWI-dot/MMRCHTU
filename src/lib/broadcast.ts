/**
 * Broadcast list domain rules. SQLite has no enums, so BroadcastList.kind and
 * BroadcastContact.source are plain Strings constrained here (same pattern as
 * RegistrationStatus in src/lib/registration.ts).
 */

export const BROADCAST_LIST_KINDS = ["CUSTOM", "CONFIRMED", "WAITING"] as const;
export type BroadcastListKind = (typeof BROADCAST_LIST_KINDS)[number];

export const BROADCAST_LIST_KIND_LABELS: Record<BroadcastListKind, string> = {
  CUSTOM: "Custom list",
  CONFIRMED: "Confirmed list",
  WAITING: "Waiting list",
};

/**
 * Registration statuses each list kind pulls from when the admin uses "import
 * from registrations". CUSTOM has no natural source — it's hand-curated — so
 * the import control is hidden for those lists.
 */
export const KIND_IMPORT_STATUS: Record<BroadcastListKind, string | null> = {
  CUSTOM: null,
  CONFIRMED: "CONFIRMED",
  WAITING: "WAITLISTED",
};

export function isBroadcastListKind(value: string): value is BroadcastListKind {
  return (BROADCAST_LIST_KINDS as readonly string[]).includes(value);
}

export function parseListKind(value: unknown): BroadcastListKind {
  const raw = String(value ?? "").toUpperCase();
  return isBroadcastListKind(raw) ? raw : "CUSTOM";
}

// Deliberately permissive: this guards against obvious typos and pasted junk,
// not against every RFC 5322 edge case. Resend rejects genuinely bad addresses
// and those are surfaced in the send report.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export interface ParsedContact {
  email: string;
  name: string;
}

/**
 * Parses the bulk "add people" textarea. Accepts one contact per line (or
 * comma/semicolon separated) in either `email` or `Name <email>` form, lower-cases
 * addresses so the (listId, email) unique constraint actually dedupes, and drops
 * anything that doesn't look like an address.
 *
 * Returns the valid contacts (deduped, first name wins) alongside the raw
 * rejected fragments so the admin sees what was skipped rather than silently
 * losing rows.
 */
export function parseContactInput(raw: string): { contacts: ParsedContact[]; invalid: string[] } {
  const fragments = raw
    .split(/[\n,;]+/)
    .map((f) => f.trim())
    .filter(Boolean);

  const byEmail = new Map<string, ParsedContact>();
  const invalid: string[] = [];

  for (const fragment of fragments) {
    // `Name <email@host>` — capture the display name, else treat the whole
    // fragment as a bare address.
    const angled = /^(.*?)<([^>]+)>$/.exec(fragment);
    const name = angled ? angled[1]!.trim().replace(/^["']|["']$/g, "") : "";
    const email = (angled ? angled[2]! : fragment).trim().toLowerCase();

    if (!isValidEmail(email)) {
      invalid.push(fragment);
      continue;
    }
    if (!byEmail.has(email)) byEmail.set(email, { email, name });
  }

  return { contacts: [...byEmail.values()], invalid };
}
