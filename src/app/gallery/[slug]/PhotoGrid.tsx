"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Album grid with a lightbox.
 *
 * The lightbox is a real modal: it traps focus, closes on Escape, moves with
 * the arrow keys, and returns focus to the thumbnail that opened it. A gallery
 * that can only be operated with a mouse excludes people for no good reason,
 * and it is the kind of thing that is much harder to retrofit than to build in.
 */

export interface GalleryPhotoView {
  id: string;
  url: string;
  caption: string;
  width: number | null;
  height: number | null;
}

export function PhotoGrid({ photos, albumTitle }: { photos: GalleryPhotoView[]; albumTitle: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggersRef = useRef<Array<HTMLButtonElement | null>>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Which thumbnail to hand focus back to when the lightbox closes.
  const lastOpenedRef = useRef<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) => {
        if (current === null) return current;
        // Wraps, so the arrow keys never dead-end at either edge.
        return (current + delta + photos.length) % photos.length;
      }),
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    lastOpenedRef.current = openIndex;

    // Move focus into the dialog on open. Without this it stays on the
    // thumbnail behind the overlay: screen readers never announce the dialog,
    // and Tab walks through the hidden page instead of the lightbox.
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "Tab") {
        // Keep Tab inside the dialog; without this, focus walks off into the
        // page behind and the modal stops being a modal.
        const dialog = dialogRef.current;
        const focusable = dialog?.querySelectorAll<HTMLElement>("button");
        if (!dialog || !focusable || focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        // Focus can sit outside the dialog — on the container itself, or on
        // the thumbnail behind if anything stole it back. Pull it in rather
        // than only handling the two edges, or the trap silently does nothing.
        if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, step]);

  // Return focus where it came from, so keyboard users are not dumped at the
  // top of the document every time they close a photo.
  useEffect(() => {
    if (openIndex !== null || lastOpenedRef.current === null) return;
    triggersRef.current[lastOpenedRef.current]?.focus();
    lastOpenedRef.current = null;
  }, [openIndex]);

  const open = openIndex === null ? null : photos[openIndex];

  return (
    <>
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              ref={(el) => {
                triggersRef.current[index] = el;
              }}
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group relative block aspect-square w-full overflow-hidden rounded-md bg-ras-purple/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ras-purple"
            >
              <Image
                src={photo.url}
                alt={photo.caption || `${albumTitle} photo ${index + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="sr-only">Open photo {index + 1} of {photos.length}</span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={open.caption || `${albumTitle} photo ${(openIndex ?? 0) + 1}`}
          // Focusable so opening can land here, but not a tab stop of its own.
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 focus:outline-none"
          // Clicking the backdrop closes; clicks on the image itself must not.
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="relative flex max-h-[80vh] w-full max-w-5xl items-center justify-center">
            <Image
              src={open.url}
              alt={open.caption || `${albumTitle} photo ${(openIndex ?? 0) + 1}`}
              width={open.width ?? 1600}
              height={open.height ?? 1200}
              sizes="100vw"
              className="max-h-[80vh] w-auto rounded-md object-contain"
              priority
            />
          </div>

          <div className="mt-4 flex w-full max-w-5xl items-center justify-between gap-4">
            <p className="min-w-0 flex-1 text-sm text-white/80">
              {open.caption}
              <span className="ml-2 whitespace-nowrap text-white/50">
                {(openIndex ?? 0) + 1} / {photos.length}
              </span>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={photos.length < 2}
                className="rounded-md border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-30"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={photos.length < 2}
                className="rounded-md border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-30"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-ras-purple hover:bg-white/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
