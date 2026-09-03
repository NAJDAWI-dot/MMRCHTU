"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_IMAGE_EDGE, fitWithin, formatBytes, isAllowedImageType } from "@/lib/gallery";
import { uploadPhotos } from "./actions";

/**
 * Uploads photos, shrinking them in the browser first.
 *
 * The downscale is the point. A modern phone photo is 4-12 MB and 4000px
 * wide; nothing on the page displays it above ~1200px, so uploading the
 * original wastes storage once and bandwidth on every single view afterwards.
 * Resizing here means the expensive copy never leaves the device.
 *
 * Dimensions are measured before upload and sent alongside each file so the
 * gallery can reserve the right space and not jump around as images load.
 */

/** Re-encode quality. High enough to look clean, low enough to matter. */
const JPEG_QUALITY = 0.85;

interface Prepared {
  file: File;
  width: number;
  height: number;
  originalSize: number;
}

/** Draws the image at its capped size and re-encodes it. */
async function shrink(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    // No canvas means no resize; send the original rather than nothing.
    return { file, width: bitmap.width, height: bitmap.height, originalSize: file.size };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return { file, width, height, originalSize: file.size };

  // Keep the original if re-encoding somehow made it bigger — true for small
  // PNG screenshots and already-optimised images.
  if (blob.size >= file.size) {
    return { file, width, height, originalSize: file.size };
  }

  const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    file: new File([blob], renamed, { type: "image/jpeg" }),
    width,
    height,
    originalSize: file.size,
  };
}

export function PhotoUploader({ albumId, disabled }: { albumId: string; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFiles(fileList: FileList) {
    const chosen = [...fileList];
    const usable = chosen.filter((f) => isAllowedImageType(f.type));
    const skipped = chosen.length - usable.length;

    if (usable.length === 0) {
      setErrors([`None of those ${chosen.length} file(s) are images we can show.`]);
      return;
    }

    setBusy(true);
    setErrors([]);
    setStatus(`Preparing ${usable.length} photo${usable.length === 1 ? "" : "s"}…`);

    try {
      const prepared: Prepared[] = [];
      for (const [i, file] of usable.entries()) {
        setStatus(`Preparing ${i + 1} of ${usable.length}…`);
        prepared.push(await shrink(file));
      }

      const before = prepared.reduce((sum, p) => sum + p.originalSize, 0);
      const after = prepared.reduce((sum, p) => sum + p.file.size, 0);

      setStatus(`Uploading ${formatBytes(after)}…`);

      const body = new FormData();
      body.set("albumId", albumId);
      prepared.forEach((p, i) => {
        body.append("photos", p.file);
        body.set(`width-${i}`, String(p.width));
        body.set(`height-${i}`, String(p.height));
      });

      const result = await uploadPhotos(body);

      const saved = before > after ? ` (${formatBytes(before - after)} saved by resizing)` : "";
      setStatus(
        result.added > 0
          ? `Added ${result.added} photo${result.added === 1 ? "" : "s"}${saved}.`
          : "Nothing was added.",
      );
      setErrors([
        ...result.errors,
        ...(skipped > 0 ? [`${skipped} file(s) skipped — not a supported image type.`] : []),
      ]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setStatus(null);
      setErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        id="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        disabled={disabled || busy}
        className="block w-full text-sm text-ras-gray file:mr-3 file:rounded-md file:border-0 file:bg-ras-purple file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-mood-plum disabled:opacity-50 dark:text-white/70"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
        }}
      />
      <p className="mt-2 text-xs text-ras-gray dark:text-white/50">
        Pick several at once. Photos are shrunk to {MAX_IMAGE_EDGE}px on their longest edge before
        upload, which is why this is quick and stays cheap to serve.
      </p>

      {busy && (
        <p className="mt-3 text-sm font-medium text-ras-purple dark:text-white" role="status">
          {status}
        </p>
      )}
      {!busy && status && (
        <p className="mt-3 text-sm font-medium text-ras-purple dark:text-white" role="status">
          {status}{" "}
          <Button
            type="button"
            variant="ghost"
            className="ml-2 px-2 py-1 text-xs"
            onClick={() => window.location.reload()}
          >
            Refresh to see them
          </Button>
        </p>
      )}
      {errors.length > 0 && (
        <ul className="mt-3 space-y-1" role="alert">
          {errors.map((message) => (
            <li key={message} className="text-sm text-accent">
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
