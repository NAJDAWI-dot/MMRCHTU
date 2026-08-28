/**
 * Gallery rules: slugs, upload limits and ordering.
 *
 * Free of Prisma, React and the blob store, so the parts that are easy to get
 * subtly wrong — a slug that collides, a filename that escapes its folder, a
 * file that is not really an image — are tested directly rather than through a
 * form.
 */

/** Image types the browser can reliably display and re-encode. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * The file extension to store each type under.
 *
 * Storage keys are built from this rather than from the uploaded filename.
 * That filename is chosen by whoever is uploading, and the payment-proof form
 * is open to the public — so an extension taken from it is an extension an
 * attacker picked. Blob storage decides what content type to serve a file as
 * from its extension, which makes that choice theirs rather than ours: a file
 * named "receipt.html", declared as image/png, passed every check the size and
 * type validation could make and was then served as a web page from a
 * permanent public URL.
 */
export const EXTENSION_FOR_IMAGE_TYPE: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Enough of the head of a file to identify any of the formats below. */
export const SNIFF_BYTES = 32;

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

/**
 * What a file actually is, from its opening bytes — or null if it is not one of
 * the types we accept.
 *
 * The declared MIME type is not evidence. It is a string in the upload request,
 * chosen by the client, and `checkUpload` believing it is what let arbitrary
 * content through. This reads the format's own header instead, which the file
 * cannot lie about and still be a working image.
 *
 * Only the head is examined, and that is sufficient for the threat: what a
 * browser does with the file is decided by the content type we store it under,
 * so establishing that the file genuinely opens as the image it claims to be is
 * the whole job. This is not a malware scanner and is not trying to be.
 */
export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";

  // RIFF container with a WEBP form type: "RIFF", four bytes of length, "WEBP".
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }

  // ISO base media: a "ftyp" box whose major or compatible brands include avif.
  // The brand list is scanned rather than only the major brand, because plenty
  // of encoders write a generic major brand and put "avif" among the compatible
  // ones. HEIC files share this container and are deliberately not matched.
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brands: string[] = [ascii(bytes, 8, 12)];
    for (let i = 16; i + 4 <= bytes.length; i += 4) {
      brands.push(ascii(bytes, i, i + 4));
    }
    if (brands.some((brand) => brand === "avif" || brand === "avis")) return "image/avif";
  }

  return null;
}

/**
 * Ceiling on an uploaded file, after the browser has downscaled it.
 *
 * The client shrinks images before sending (see PhotoUploader), so anything
 * arriving above this either skipped that step or is not what it claims to be.
 * Bandwidth, not storage, is what a photo gallery actually costs.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Longest edge kept when the browser downscales, in pixels. */
export const MAX_IMAGE_EDGE = 2000;

export function isAllowedImageType(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Turns a title into a URL-safe slug.
 *
 * Strips accents so "Café Session" and "Cafe Session" cannot become two
 * different-looking URLs for the same thing, and collapses everything else to
 * single hyphens.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    // A trailing hyphen can reappear after the slice.
    .replace(/-+$/g, "");
}

/**
 * A slug not already in use, suffixing -2, -3... as needed.
 *
 * Titles that slugify to nothing at all — an album named only in Arabic, or
 * just punctuation — still need a URL, so they fall back to "album".
 */
export function uniqueSlug(title: string, taken: readonly string[]): string {
  const base = slugify(title) || "album";
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  // Practically unreachable; better than looping forever.
  return `${base}-${Date.now()}`;
}

/**
 * A safe storage key for an upload.
 *
 * Nothing from the uploaded filename survives — not even the extension, which
 * this used to keep. The extension decides what content type blob storage
 * serves the file as, so taking it from the upload handed that decision to
 * whoever sent the file; it now comes from the type the bytes were verified to
 * be. Path separators and ".." cannot appear because no part of the key is
 * copied from input any more.
 *
 * The album name is repeated in the file part rather than only in the folder,
 * because downloads are named after the file alone — a visitor saving a photo
 * should end up with "mmrc-26-finals-k3f9a1.jpg" in their downloads folder,
 * not a bare timestamp they cannot place a week later.
 */
export function storageKey(albumSlug: string, imageType: AllowedImageType, unique: string): string {
  const folder = slugify(albumSlug) || "album";
  return `gallery/${folder}/${folder}-${unique}.${EXTENSION_FOR_IMAGE_TYPE[imageType]}`;
}

export interface UploadProblem {
  file: string;
  reason: string;
}

/** Validates one file, returning the reason it cannot be accepted, or null. */
export function checkUpload(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) return "The file is empty.";
  if (!isAllowedImageType(file.type)) {
    return `${file.type || "That file type"} is not an image we can show.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Too large at ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Scales dimensions so the longest edge fits `maxEdge`, never enlarging.
 *
 * Upscaling a small photo would cost bandwidth to deliver blur, so an image
 * already within bounds is returned untouched.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Renumbers photos 0, 1, 2... after a move.
 *
 * Reordering by swapping stored values leaves gaps and duplicates over time,
 * which then makes the sort order depend on insertion order. Rewriting the
 * whole sequence keeps it total.
 */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

/** Albums newest event first, undated ones last, then by title. */
export function sortAlbums<T extends { eventDate: Date | null; sortOrder: number; title: string }>(
  albums: readonly T[],
): T[] {
  return [...albums].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.eventDate && b.eventDate) return b.eventDate.getTime() - a.eventDate.getTime();
    if (a.eventDate) return -1;
    if (b.eventDate) return 1;
    return a.title.localeCompare(b.title);
  });
}
