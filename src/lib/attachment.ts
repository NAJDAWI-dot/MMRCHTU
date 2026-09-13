/**
 * What may be attached to a broadcast, and under what name.
 *
 * A separate file from gallery.ts, which answers the same questions for images
 * only and answers them differently: a gallery photo is downscaled in the
 * browser and re-encoded, so its bytes are ours by the time they are stored,
 * while an attachment must arrive at the recipient byte-for-byte identical to
 * the file the admin picked. Sharing one module would mean one of those two
 * rules quietly applying to the other.
 *
 * Free of React, node and the DOM: the composer needs these limits to refuse a
 * file before uploading it, and the action needs the same limits to refuse it
 * again on arrival.
 */

/**
 * The types an admin can attach.
 *
 * A deliberately short list. Everything on it is either a document somebody
 * sends about a competition, or an image — and nothing on it is executable or
 * is interpreted by the thing that opens it. Adding a type here means deciding
 * that a mail client opening it by double-click is acceptable.
 */
export const ATTACHMENT_TYPES = {
  "application/pdf": { extension: "pdf", label: "PDF" },
  "image/png": { extension: "png", label: "PNG image" },
  "image/jpeg": { extension: "jpg", label: "JPEG image" },
  "image/webp": { extension: "webp", label: "WebP image" },
  "image/gif": { extension: "gif", label: "GIF image" },
  "text/plain": { extension: "txt", label: "Text file" },
  "text/csv": { extension: "csv", label: "CSV spreadsheet" },
  "application/zip": { extension: "zip", label: "ZIP archive" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    label: "Word document",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extension: "xlsx",
    label: "Excel spreadsheet",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extension: "pptx",
    label: "PowerPoint deck",
  },
} as const;

export type AttachmentType = keyof typeof ATTACHMENT_TYPES;

export function isAttachmentType(value: string): value is AttachmentType {
  return Object.prototype.hasOwnProperty.call(ATTACHMENT_TYPES, value);
}

/** What the file picker offers, so the dialog does not show every file on disk. */
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES).join(",");

/** A readable list for the hint under the control. */
export const ATTACHMENT_TYPE_SUMMARY = "PDF, Word, Excel, PowerPoint, images, CSV, text or ZIP";

/**
 * Per file, and for the message as a whole.
 *
 * The provider's own ceiling is higher, but a 30MB email is one that bounces
 * off half the mailboxes it is sent to — a university inbox quota is the real
 * limit here, not the API's.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The name the recipient will see.
 *
 * Only the last path segment is kept, because a filename is not a path.
 * Control characters and the bidirectional overrides go because both are used
 * to disguise an extension in a mail client's file list. The extension is then
 * replaced with the one for the type the bytes were verified to be, so a
 * "notes.pdf" that is really a ZIP arrives called what it is.
 */
export function attachmentFilename(raw: string, type: AttachmentType): string {
  // The last segment first: a filename is not a path, and flattening the
  // separators before stripping the extension mangles any directory with a
  // dot in it ("../../etc/passwd" came out as ".. ..").
  const base = (raw || "").split(/[\\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\.[^.]*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${cleaned || "attachment"}.${ATTACHMENT_TYPES[type].extension}`;
}

/**
 * Where the file is stored, which is never derived from what it was called.
 *
 * The same rule as gallery.ts states at length: blob storage decides how it
 * will serve a file from the extension in its key, so an extension taken from
 * the upload hands that decision to whoever uploaded it.
 */
export function attachmentStorageKey(type: AttachmentType, unique: string): string {
  return `broadcasts/${unique}.${ATTACHMENT_TYPES[type].extension}`;
}

/** Enough of the head of a file to identify every format above. */
export const ATTACHMENT_SNIFF_BYTES = 16;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte);
}

const PDF = [0x25, 0x50, 0x44, 0x46] as const; // %PDF
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG = [0xff, 0xd8, 0xff] as const;
const GIF = [0x47, 0x49, 0x46, 0x38] as const; // GIF8
const ZIP = [0x50, 0x4b] as const; // PK — docx, xlsx, pptx and zip alike

/**
 * What the bytes actually are, given what the browser said they were.
 *
 * The declared type is used, but only as a tie-break inside a family the
 * signature has already confirmed: every Office format is a ZIP, so the bytes
 * can prove "this is a zip container" and nothing more, and the declared type
 * decides which one — a wrong answer there means an attachment opens in the
 * wrong program, not that anything unsafe was stored.
 *
 * Plain text and CSV have no signature at all and are the one case decided by
 * the declaration alone. That is acceptable precisely because they are inert:
 * the worst outcome is a .txt containing something that would have been
 * interesting had anything ever executed it.
 */
export function sniffAttachmentType(bytes: Uint8Array, declared: string): AttachmentType | null {
  if (startsWith(bytes, PDF)) return "application/pdf";
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, GIF)) return "image/gif";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (startsWith(bytes, ZIP)) {
    const zipFamily: readonly string[] = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
    ];
    return zipFamily.includes(declared) ? (declared as AttachmentType) : "application/zip";
  }
  if (declared === "text/plain" || declared === "text/csv") return declared;
  return null;
}

export interface AttachmentCandidate {
  name: string;
  type: string;
  size: number;
}

/**
 * Everything that can be judged before reading a byte, so the browser can
 * refuse a file without uploading it first.
 *
 * `alreadyAttached` and `bytesAttached` are passed in rather than read here,
 * because this runs on both sides and only one of them has the database.
 */
export function checkAttachment(
  file: AttachmentCandidate,
  context: { alreadyAttached: number; bytesAttached: number },
): string | null {
  if (context.alreadyAttached >= MAX_ATTACHMENTS) {
    return `You already have ${MAX_ATTACHMENTS} attachments. Remove one first.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)} per file.`;
  }
  if (context.bytesAttached + file.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
    return `That would take this email over ${formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)} of attachments, which many inboxes refuse.`;
  }
  if (!isAttachmentType(file.type)) {
    return `"${file.name}" is not a type that can be attached. Allowed: ${ATTACHMENT_TYPE_SUMMARY}.`;
  }
  return null;
}
