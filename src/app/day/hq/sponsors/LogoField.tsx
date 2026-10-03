"use client";

import { useEffect, useRef, useState } from "react";
import { SponsorLogo } from "@/components/day-site/SponsorLogo";
import { DARK_TILE, logoBackgroundFor, type LogoBackground } from "@/lib/sponsors";

const LOGO_TYPES = "image/png,image/webp,image/jpeg,image/avif";

/**
 * Which tile suits an image, read from its pixels on a small canvas. Null when
 * the pixels cannot be read: a file that will not decode, or a stored logo
 * whose host does not allow it.
 */
async function backgroundOf(src: string, crossOrigin: boolean): Promise<LogoBackground | null> {
  try {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    const scale = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return logoBackgroundFor(context.getImageData(0, 0, canvas.width, canvas.height).data);
  } catch {
    return null;
  }
}

/**
 * The logo file and the tile behind it. Choosing a file shows it at once and
 * picks the tile from the logo itself: a white logo goes on the dark tile, so
 * it does not vanish into the white one. The desk can change the tile either way.
 */
export function LogoField({
  id,
  name,
  label,
  currentUrl = "",
  currentBackground = "WHITE",
}: {
  id: string;
  name: string;
  label: string;
  currentUrl?: string;
  currentBackground?: LogoBackground;
}) {
  const [preview, setPreview] = useState(currentUrl);
  const [background, setBackground] = useState<LogoBackground>(currentBackground);
  const [note, setNote] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // A logo already saved on white that turns out to be light: say so.
  useEffect(() => {
    if (!currentUrl || currentBackground === "DARK") return;
    let live = true;
    void backgroundOf(currentUrl, true).then((found) => {
      if (live && found === "DARK") setNote("This logo is light, so it hardly shows on white. Choose the dark tile and save.");
    });
    return () => {
      live = false;
    };
  }, [currentUrl, currentBackground]);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  // The add form empties itself after a save; the preview and tile go back too.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => {
      setPreview(currentUrl);
      setBackground(currentBackground);
      setNote("");
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [currentUrl, currentBackground]);

  const choose = async (file: File | undefined) => {
    if (!file) {
      setPreview(currentUrl);
      setBackground(currentBackground);
      setNote("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    const found = await backgroundOf(url, false);
    if (!found) {
      setNote("");
      return;
    }
    setBackground(found);
    setNote(found === "DARK" ? "A light logo, so it goes on the dark tile." : "");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0 space-y-3">
        <div>
          <label className="day-label" htmlFor={id}>
            {label}
          </label>
          <input ref={input} id={id} name="logo" type="file" accept={LOGO_TYPES} onChange={(event) => void choose(event.target.files?.[0])} className="day-input py-2" />
        </div>
        <fieldset>
          <legend className="day-label">Tile behind the logo</legend>
          <div className="day-segment mt-1">
            {(["WHITE", "DARK"] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="logoBackground" value={value} checked={background === value} onChange={() => setBackground(value)} />
                <span>
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
                    <circle cx="6" cy="6" r="5.5" fill={value === "WHITE" ? "#fff" : DARK_TILE} stroke="rgb(var(--day-line) / 0.35)" />
                  </svg>
                  {value === "WHITE" ? "White" : "Dark"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {note ? (
          <p role="status" className="text-sm text-day-muted">
            {note}
          </p>
        ) : null}
      </div>
      {preview ? <SponsorLogo name={name || "The logo"} logoUrl={preview} background={background} className="aspect-[3/2] w-36 p-2.5" nameClass="text-base" /> : null}
    </div>
  );
}
