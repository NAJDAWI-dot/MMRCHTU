import { describe, expect, it } from "vitest";
import { inlineScreenshotType, paymentScreenshotKey } from "@/lib/payment-proof";

describe("paymentScreenshotKey", () => {
  it("files a screenshot under the registration it belongs to", () => {
    expect(paymentScreenshotKey("reg123", "image/png", "abc")).toBe(
      "payments/reg123/reg123-abc.png",
    );
  });

  it("takes its extension from the verified type, never from the upload", () => {
    // This is the whole fix. The extension decides what blob storage serves
    // the file as, and this form is open to the public — so a key built from
    // the uploaded filename let a stranger choose it.
    expect(paymentScreenshotKey("r", "image/jpeg", "u")).toBe("payments/r/r-u.jpg");
    expect(paymentScreenshotKey("r", "image/webp", "u")).toBe("payments/r/r-u.webp");
    expect(paymentScreenshotKey("r", "image/avif", "u")).toBe("payments/r/r-u.avif");
  });

  it("has no parameter a filename could arrive in at all", () => {
    const key = paymentScreenshotKey("reg123", "image/png", "abc");
    expect(key).toBe("payments/reg123/reg123-abc.png");
    expect(key).not.toContain("..");
  });

  it("strips anything unexpected from the registration id", () => {
    expect(paymentScreenshotKey("../../evil", "image/png", "u")).toBe("payments/evil/evil-u.png");
  });

  it("never produces a key an attacker could have chosen the extension of", () => {
    // Belt and braces on the type: every accepted type maps to a known-inert
    // raster extension, so no input path reaches .html, .svg or .js.
    const dangerous = [".html", ".svg", ".js", ".htm", ".xhtml"];
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"] as const) {
      const key = paymentScreenshotKey("r", type, "u");
      expect(dangerous.some((ext) => key.endsWith(ext))).toBe(false);
    }
  });
});

describe("inlineScreenshotType", () => {
  it("renders the image types the uploader accepts", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(inlineScreenshotType(type)).toBe(type);
    }
  });

  it("ignores parameters after the media type", () => {
    // "image/png; charset=binary" is still a png; a bare comparison misses it.
    expect(inlineScreenshotType("image/png; charset=binary")).toBe("image/png");
    expect(inlineScreenshotType("  IMAGE/JPEG  ")).toBe("image/jpeg");
  });

  it("refuses to render anything a browser could execute", () => {
    // The whole point: these are bytes a stranger uploaded, and rendering them
    // as a document on this origin would run whatever script is inside.
    expect(inlineScreenshotType("image/svg+xml")).toBeNull();
    expect(inlineScreenshotType("text/html")).toBeNull();
    expect(inlineScreenshotType("application/xhtml+xml")).toBeNull();
    expect(inlineScreenshotType("application/pdf")).toBeNull();
  });

  it("refuses an unknown, absent or empty type rather than guessing", () => {
    expect(inlineScreenshotType("application/octet-stream")).toBeNull();
    expect(inlineScreenshotType(null)).toBeNull();
    expect(inlineScreenshotType(undefined)).toBeNull();
    expect(inlineScreenshotType("")).toBeNull();
  });

  it("does not accept a type that merely contains an allowed one", () => {
    expect(inlineScreenshotType("text/html+image/png")).toBeNull();
  });
});
