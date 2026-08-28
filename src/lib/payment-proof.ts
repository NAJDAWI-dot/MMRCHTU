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

import {
  EXTENSION_FOR_IMAGE_TYPE,
  isAllowedImageType,
  type AllowedImageType,
} from "@/lib/gallery";

/**
 * A storage key for one screenshot.
 *
 * Nothing from the upload reaches this key. It used to keep the filename's
 * extension, which is the part that matters most: blob storage picks the
 * content type it serves a file under from its extension, so an extension
 * taken from the upload let the uploader choose it. This form is open to the
 * public, so "the uploader" is anyone — a file named "receipt.html" and
 * declared as image/png passed every check and was then served as a web page
 * from a permanent public URL. The extension now comes from the type the bytes
 * were verified to be.
 *
 * Deliberately not gallery.ts's `storageKey`, which hard-codes a `gallery/`
 * prefix — payment proofs are not gallery photos and must not be reachable by
 * anything that lists that folder.
 */
export function paymentScreenshotKey(
  registrationId: string,
  imageType: AllowedImageType,
  unique: string,
): string {
  const safeId = registrationId.replace(/[^a-zA-Z0-9]/g, "");
  return `payments/${safeId}/${safeId}-${unique}.${EXTENSION_FOR_IMAGE_TYPE[imageType]}`;
}

/**
 * The content type a stored screenshot may be rendered under, or null if it
 * must only ever be offered as a download.
 *
 * Showing a proof of payment in the admin panel means serving bytes a stranger
 * uploaded as a document on this origin, in a session that is by definition an
 * admin's. A browser that decides those bytes are HTML or SVG will run whatever
 * script is in them. So the stored type is never passed through to the browser:
 * it is matched here against the uploader's own allowlist, every member of
 * which is an inert raster format, and anything else — an old row, a type the
 * store guessed, an upload that predates validation — falls back to being
 * downloaded rather than rendered.
 *
 * Parameters after ";" are dropped, since "image/png; charset=binary" is a png
 * and a bare string comparison would miss it.
 */
export function inlineScreenshotType(storedType: string | null | undefined): string | null {
  const type = (storedType ?? "").split(";")[0]!.trim().toLowerCase();
  return isAllowedImageType(type) ? type : null;
}

/**
 * How long teams are told verification takes.
 *
 * One constant rather than the phrase typed into a page, an email and a policy
 * separately — those three saying different numbers is exactly the kind of
 * thing nobody notices until someone complains on the third day.
 */
export const VERIFICATION_WINDOW_TEXT = "24–48 hours";
