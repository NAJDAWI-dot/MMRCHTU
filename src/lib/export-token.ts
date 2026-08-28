import { timingSafeEqual } from "node:crypto";

/**
 * The shared secret that lets Excel read the registration export.
 *
 * Excel cannot hold an admin session — Power Query fetches a URL, it does not
 * log in — so the feed needs a credential that travels in the request. That is
 * a real cost, not a detail: anyone holding this token can read every
 * registrant's name, email, phone number and university, with no account and
 * no audit trail. It is worth setting only because the alternative people
 * actually adopt is emailing a spreadsheet around, which is worse.
 *
 * Rotating REGISTRATIONS_EXPORT_TOKEN revokes it instantly, and unsetting it
 * turns the feed off entirely while leaving the admin download working.
 */

/** Short tokens are guessable; this is the length the setup instructions give. */
export const MIN_EXPORT_TOKEN_LENGTH = 32;

/**
 * Whether a supplied token matches the configured one.
 *
 * The three guards before the comparison are the interesting part. An unset or
 * blank secret must never match anything, or turning the feature off would
 * turn it into an open endpoint. A too-short secret is refused outright rather
 * than honoured, so a placeholder value someone pasted in while experimenting
 * cannot quietly become production's only protection.
 *
 * The comparison itself is timing-safe, and length is compared first because
 * timingSafeEqual throws on a length mismatch rather than returning false.
 */
export function exportTokenMatches(
  supplied: string | null | undefined,
  configured: string | null | undefined,
): boolean {
  const secret = (configured ?? "").trim();
  if (secret.length < MIN_EXPORT_TOKEN_LENGTH) return false;

  const given = supplied ?? "";
  if (given.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
