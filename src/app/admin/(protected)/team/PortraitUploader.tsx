"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fitWithin, isAllowedImageType } from "@/lib/gallery";
import { uploadMemberPhoto } from "./actions";

/**
 * Uploads one committee portrait, shrinking it in the browser first.
 *
 * The same reasoning as the gallery's uploader, only more so: a portrait is
 * shown at about 160px and a phone photo is 4000px wide, so sending the
 * original wastes storage once and bandwidth on every visit to the Team page
 * afterwards. The expensive copy never leaves the device.
 *
 * Capped smaller than gallery photos because nothing displays a portrait large
 * — it is a face in a circle, not something anyone opens full size.
 */

/** Longest edge kept for a portrait. */
const MAX_PORTRAIT_EDGE = 800;
const JPEG_QUALITY = 0.85;

async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_PORTRAIT_EDGE);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    // Keep the original when re-encoding made it bigger, which is true of
    // small PNGs and already-optimised images.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    // No canvas, or an image the browser cannot decode. Send the original and
    // let the server's own checks be the judge.
    return file;
  }
}

export function PortraitUploader({ memberId, hasPhoto }: { memberId: string; hasPhoto: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!isAllowedImageType(file.type)) {
      setError("Choose a JPEG, PNG, WebP or AVIF image.");
      return;
    }

    setBusy(true);
    try {
      const prepared = await shrink(file);
      const body = new FormData();
      body.set("id", memberId);
      body.set("photo", prepared);

      const result = await uploadMemberPhoto(body);
      if (!result.ok) setError(result.error ?? "The upload did not go through.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      // Cleared so choosing the same file again still fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : hasPhoto ? "Replace photo" : "Add photo"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
