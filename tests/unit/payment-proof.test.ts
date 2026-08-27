import { describe, expect, it } from "vitest";
import { inlineScreenshotType, paymentScreenshotKey } from "@/lib/payment-proof";

describe("paymentScreenshotKey", () => {
  it("files a screenshot under the registration it belongs to", () => {
    expect(paymentScreenshotKey("reg123", "receipt.png", "abc")).toBe(
      "payments/reg123/reg123-abc.png",
    );
  });

  it("never lets an uploaded filename escape its folder", () => {
    // The name is chosen by the uploader, so "../" in it must not travel.
    const key = paymentScreenshotKey("reg123", "../../etc/passwd.png", "abc");
    expect(key).toBe("payments/reg123/reg123-abc.png");
    expect(key).not.toContain("..");
  });

  it("falls back to jpg when there is no usable extension", () => {
    expect(paymentScreenshotKey("reg1", "screenshot", "u")).toBe("payments/reg1/reg1-u.jpg");
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
