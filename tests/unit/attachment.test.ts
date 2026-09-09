import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  attachmentFilename,
  attachmentStorageKey,
  checkAttachment,
  formatBytes,
  isAttachmentType,
  sniffAttachmentType,
} from "@/lib/attachment";

/*
  What may ride along with a broadcast.

  The sniffing tests are the point of the file. A mail client decides how to
  open an attachment from what it is told the file is, so the declared type is
  the one thing that must not be taken at face value — and the ZIP family is
  where that gets interesting, because every Office document is a ZIP and the
  bytes cannot tell one from another.
*/

const bytes = (...values: number[]) => new Uint8Array(values);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04);
const WEBP = new Uint8Array([
  ...[0x52, 0x49, 0x46, 0x46], // RIFF
  ...[0, 0, 0, 0],
  ...[0x57, 0x45, 0x42, 0x50], // WEBP
]);

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("what a file actually is", () => {
  it("recognises the formats by their signature, whatever they claim to be", () => {
    expect(sniffAttachmentType(PDF, "text/plain")).toBe("application/pdf");
    expect(sniffAttachmentType(PNG, "application/pdf")).toBe("image/png");
    expect(sniffAttachmentType(JPEG, "image/png")).toBe("image/jpeg");
    expect(sniffAttachmentType(GIF, "image/png")).toBe("image/gif");
    expect(sniffAttachmentType(WEBP, "image/png")).toBe("image/webp");
  });

  it("uses the declared type only to pick within the ZIP family", () => {
    expect(sniffAttachmentType(ZIP, DOCX)).toBe(DOCX);
    expect(sniffAttachmentType(ZIP, XLSX)).toBe(XLSX);
    expect(sniffAttachmentType(ZIP, "application/zip")).toBe("application/zip");
  });

  it("falls back to a plain archive when a ZIP claims to be something else", () => {
    // The claim is not honoured — the bytes only prove it is a zip container,
    // so that is what it is stored and sent as.
    expect(sniffAttachmentType(ZIP, "application/pdf")).toBe("application/zip");
  });

  it("takes text and CSV on their word, because they have no signature", () => {
    expect(sniffAttachmentType(bytes(0x48, 0x69), "text/plain")).toBe("text/plain");
    expect(sniffAttachmentType(bytes(0x61, 0x2c, 0x62), "text/csv")).toBe("text/csv");
  });

  it("refuses anything it cannot place", () => {
    expect(sniffAttachmentType(bytes(0x4d, 0x5a, 0x90, 0x00), "application/pdf")).toBeNull();
    expect(sniffAttachmentType(bytes(0x00), "application/x-msdownload")).toBeNull();
  });

  it("refuses an empty head rather than guessing", () => {
    expect(sniffAttachmentType(new Uint8Array(), "application/pdf")).toBeNull();
  });
});

describe("the name the recipient sees", () => {
  it("keeps the name and corrects the extension to what the file is", () => {
    expect(attachmentFilename("Rulebook v1.1.pdf", "application/pdf")).toBe("Rulebook v1.1.pdf");
    expect(attachmentFilename("notes.pdf", "application/zip")).toBe("notes.zip");
  });

  it("is a filename, not a path — it keeps the last segment only", () => {
    expect(attachmentFilename("../../etc/passwd", "text/plain")).toBe("passwd.txt");
    expect(attachmentFilename("C:\\Users\\me\\rules.pdf", "application/pdf")).toBe("rules.pdf");
  });

  it("strips the characters used to disguise an extension", () => {
    // A right-to-left override makes "annexe\u202Egpj.exe" read as a JPEG in a
    // mail client's file list.
    const disguised = attachmentFilename("annexe\u202Egpj.exe", "image/jpeg");
    expect(disguised).not.toContain("\u202e");
    expect(disguised.endsWith(".jpg")).toBe(true);
  });

  it("always produces something", () => {
    expect(attachmentFilename("", "application/pdf")).toBe("attachment.pdf");
    expect(attachmentFilename(".pdf", "application/pdf")).toBe("attachment.pdf");
  });

  it("bounds a very long name", () => {
    const long = `${"a".repeat(300)}.pdf`;
    expect(attachmentFilename(long, "application/pdf").length).toBeLessThan(100);
  });
});

describe("where it is stored", () => {
  it("never derives the key from what the file was called", () => {
    // Blob storage decides how it will serve a file from the extension in its
    // key, so an extension taken from an upload hands that choice away.
    const key = attachmentStorageKey("application/pdf", "abc123");
    expect(key).toBe("broadcasts/abc123.pdf");
  });
});

describe("what can be attached at all", () => {
  const clean = { alreadyAttached: 0, bytesAttached: 0 };

  it("accepts an ordinary file", () => {
    expect(
      checkAttachment({ name: "rules.pdf", type: "application/pdf", size: 200_000 }, clean),
    ).toBeNull();
  });

  it("refuses a type that is not on the list", () => {
    const problem = checkAttachment(
      { name: "run.exe", type: "application/x-msdownload", size: 10 },
      clean,
    );
    expect(problem).toMatch(/not a type that can be attached/i);
  });

  it("refuses one that is too big, and says how big it is", () => {
    const problem = checkAttachment(
      { name: "video.zip", type: "application/zip", size: MAX_ATTACHMENT_BYTES + 1 },
      clean,
    );
    expect(problem).toMatch(/limit is/i);
  });

  it("refuses one that would take the whole email over the inbox limit", () => {
    const problem = checkAttachment(
      { name: "deck.pptx", type: "application/zip", size: 5 * 1024 * 1024 },
      { alreadyAttached: 2, bytesAttached: MAX_ATTACHMENTS_TOTAL_BYTES - 1024 },
    );
    expect(problem).toMatch(/many inboxes refuse/i);
  });

  it("refuses an empty file", () => {
    expect(checkAttachment({ name: "empty.pdf", type: "application/pdf", size: 0 }, clean)).toMatch(
      /empty/i,
    );
  });

  it("stops at the count limit", () => {
    const problem = checkAttachment(
      { name: "one-more.pdf", type: "application/pdf", size: 10 },
      { alreadyAttached: MAX_ATTACHMENTS, bytesAttached: 10 },
    );
    expect(problem).toMatch(/remove one first/i);
  });

  it("knows the allowed types", () => {
    expect(isAttachmentType("application/pdf")).toBe(true);
    expect(isAttachmentType("application/x-msdownload")).toBe(false);
    // Not inherited from Object.prototype.
    expect(isAttachmentType("toString")).toBe(false);
  });
});

describe("sizes people can read", () => {
  it("scales the unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
