"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DayIcon } from "@/components/day-site/icons";
import { CAPTION_MAX, formatBytes, isAllowedImageType } from "@/lib/gallery";
import { shrinkPhoto, type PreparedPhoto } from "@/lib/photo-shrink";
import { uploadDayPhotos } from "./actions";

/**
 * The Photos desk's one control, made for a phone in the hall: one big button
 * that opens the camera or the photo library, an optional caption, and the
 * pictures are on the day site and the hall screen a moment later.
 *
 * Photos are shrunk on the phone before they leave it, the same as in the
 * gallery admin, which matters more here: the hall's connection is shared by
 * everyone in it.
 */
export function DayPhotoUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function send(fileList: FileList) {
    const chosen = [...fileList].filter((file) => file.type.startsWith("image/") || file.type === "");
    if (chosen.length === 0) {
      setStatus({ ok: false, text: "Those are not photos." });
      return;
    }

    setBusy(true);
    setErrors([]);
    const problems: string[] = [];
    try {
      const prepared: PreparedPhoto[] = [];
      for (const [index, file] of chosen.entries()) {
        setStatus({ ok: true, text: `Preparing ${index + 1} of ${chosen.length}…` });
        try {
          // A type the site cannot serve is turned into a JPEG here rather than refused.
          prepared.push(await shrinkPhoto(file, { forceJpeg: !isAllowedImageType(file.type) }));
        } catch {
          problems.push(`${file.name}: this phone could not open it. Try a JPEG.`);
        }
      }
      if (prepared.length === 0) {
        setStatus(null);
        setErrors(problems);
        return;
      }

      setStatus({ ok: true, text: `Uploading ${formatBytes(prepared.reduce((sum, photo) => sum + photo.file.size, 0))}…` });
      const body = new FormData();
      body.set("caption", caption);
      prepared.forEach((photo, index) => {
        body.append("photos", photo.file);
        body.set(`width-${index}`, String(photo.width));
        body.set(`height-${index}`, String(photo.height));
      });
      const result = await uploadDayPhotos(body);

      setStatus(
        result.added
          ? { ok: true, text: `${result.added} photo${result.added === 1 ? " is" : "s are"} up.` }
          : { ok: false, text: "Nothing went up." },
      );
      setErrors([...problems, ...result.errors]);
      if (result.added) {
        setCaption("");
        router.refresh();
      }
    } catch (error) {
      setStatus(null);
      setErrors([...problems, error instanceof Error ? error.message : String(error)]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="day-label" htmlFor="photo-caption">
          Caption, for this batch (optional)
        </label>
        <input
          id="photo-caption"
          value={caption}
          maxLength={CAPTION_MAX}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Team Falcon reaches the centre"
          className="day-input"
          disabled={busy}
        />
      </div>

      <input
        ref={inputRef}
        id="day-photos"
        type="file"
        accept="image/*"
        multiple
        className="peer sr-only"
        disabled={busy}
        onChange={(event) => {
          if (event.target.files?.length) void send(event.target.files);
        }}
      />
      <label
        htmlFor="day-photos"
        aria-disabled={busy}
        className={`day-btn day-btn-ink h-14 w-full cursor-pointer text-base peer-focus-visible:ring-2 peer-focus-visible:ring-day-crimson peer-focus-visible:ring-offset-2 sm:w-auto sm:px-8 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <DayIcon name="camera" className="h-5 w-5" />
        {busy ? "Sending…" : "Take or add photos"}
      </label>

      {status ? (
        <p role="status" className={`text-sm font-semibold ${status.ok ? "text-day-good" : "text-day-live"}`}>
          {status.text}
        </p>
      ) : null}
      {errors.length ? (
        <ul role="alert" className="space-y-1 text-sm text-day-live">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
