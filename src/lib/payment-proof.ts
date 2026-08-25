/**
 * Where a team's proof-of-payment screenshot is stored.
 *
 * CliQ has no callback, so the only evidence the site ever sees that money
 * moved is a picture the team took of their banking app. It is filed under the
 * registration it belongs to, so an admin reconciling a bank statement can find
 * one team's proof without scanning a flat bucket.
 *
 * The upload rules themselves — which image types, how large — are not restated
 * here. They live in gallery.ts and are shared as-is, because "an image this
 * site can display" means the same thing whether it is a competition photo or a
 * bank receipt, and two copies of that answer would drift.
 */

/**
 * A storage key for one screenshot.
 *
 * The uploaded filename is never trusted: it can carry path separators, "..",
 * or arbitrary unicode. Only a sanitised extension survives; the rest of the
 * key is built from the registration id and a caller-supplied unique part.
 *
 * Deliberately not gallery.ts's `storageKey`, which hard-codes a `gallery/`
 * prefix — payment proofs are not gallery photos and must not be reachable by
 * anything that lists that folder.
 */
export function paymentScreenshotKey(
  registrationId: string,
  originalName: string,
  unique: string,
): string {
  const ext = (originalName.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1] ?? "jpg").toLowerCase();
  const safeId = registrationId.replace(/[^a-zA-Z0-9]/g, "");
  return `payments/${safeId}/${safeId}-${unique}.${ext}`;
}

/**
 * How long teams are told verification takes.
 *
 * One constant rather than the phrase typed into a page, an email and a policy
 * separately — those three saying different numbers is exactly the kind of
 * thing nobody notices until someone complains on the third day.
 */
export const VERIFICATION_WINDOW_TEXT = "24–48 hours";
