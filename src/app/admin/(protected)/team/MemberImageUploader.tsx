"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fitWithin, isAllowedImageType } from "@/lib/gallery";
import { uploadMemberPhoto, uploadMemberStage } from "./actions";

/**
 * Uploads one of a committee member's two pictures, shrinking it in the browser
 * first.
 *
 * The same reasoning as the gallery's uploader, only more so: a phone photo is
 * 4000px wide and nothing here displays one at anything like that, so sending
 * the original wastes storage once and bandwidth on every visit afterwards. The
 * expensive copy never leaves the device.
 *
 * The two slots are capped differently because they are looked at differently.
 * A portrait is a face in a circle; a stage is drawn full-bleed behind the
 * tribute popup and would show its own compression if it were treated the same.
 */

type Slot = "portrait" | "stage";

const SLOT = {
  portrait: {
    maxEdge: 800,
    quality: 0.85,
    action: uploadMemberPhoto,
    add: "Add photo",
    replace: "Replace photo",
  },
  stage: {
    maxEdge: 1600,
    quality: 0.82,
    action: uploadMemberStage,
    add: "Add stage",
    replace: "Replace stage",
  },
} as const;

async function shrink(file: File, maxEdge: number, quality: number): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);

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
      canvas.toBlob(resolve, "image/jpeg", quality),
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

export function MemberImageUploader({
  memberId,
  slot,
  hasImage,
}: {
  memberId: string;
  slot: Slot;
  hasImage: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = SLOT[slot];

  async function handleFile(file: File) {
    setError(null);

    if (!isAllowedImageType(file.type)) {
      setError("Choose a JPEG, PNG, WebP or AVIF image.");
      return;
    }

    setBusy(true);
    try {
      const prepared = await shrink(file, rules.maxEdge, rules.quality);
      const body = new FormData();
      body.set("id", memberId);
      body.set("photo", prepared);

      const result = await rules.action(body);
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
        {busy ? "Uploading…" : hasImage ? rules.replace : rules.add}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
