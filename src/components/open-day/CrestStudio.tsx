"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { crestFor, hasCrest } from "@/lib/crest";
import { CREST_CARD, crestCardSvg, crestFileName } from "@/lib/open-day";

/**
 * Type a name, get a maze that belongs to it, take it away.
 *
 * The crest generator has been on the site since registration opened, but only
 * inside the form, where it appears beside a field somebody is already halfway
 * through filling in. At a stand that is the wrong way round: "type a name and
 * see what you get" is a reason to stop walking, and the registration form is
 * what comes after, if it comes at all.
 *
 * The preview is the very markup that gets downloaded, rendered as an image
 * rather than as elements. Two drawings would drift, and a visitor who posts
 * the card should be posting the thing they were shown.
 */
export function CrestStudio({ referral }: { referral?: string }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const ready = hasCrest(name);
  const card = useMemo(() => {
    const maze = crestFor(name);
    return maze ? crestCardSvg({ name, maze }) : null;
  }, [name]);

  const source = card ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(card)}` : null;

  /** The register link, carrying the name so nobody types it twice. */
  const registerHref = (() => {
    const params = new URLSearchParams();
    if (ready) params.set("team", name.trim());
    if (referral) params.set("ref", referral);
    const query = params.toString();
    return query ? `/register?${query}` : "/register";
  })();

  async function download() {
    if (!card || !source) return;
    setStatus(null);

    try {
      // Rasterised through an <img> rather than handed straight to the phone,
      // because a PNG is what a gallery, a story and a chat all accept without
      // argument. onload rather than decode(): older phones turn up at stands.
      const image = new Image();
      image.width = CREST_CARD.width;
      image.height = CREST_CARD.height;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The card image could not be drawn."));
        image.src = source;
      });

      const canvas = document.createElement("canvas");
      canvas.width = CREST_CARD.width;
      canvas.height = CREST_CARD.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No canvas.");
      context.drawImage(image, 0, 0, CREST_CARD.width, CREST_CARD.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No image.");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = crestFileName(name);
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Saved to your downloads.");
    } catch {
      // Nothing here is worth an error message on its own: the card is on
      // screen either way, and holding a finger on a picture is something
      // everybody at a stand already knows how to do.
      setStatus("Your phone would not save it. Press and hold the card instead.");
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:items-start">
      <div className="mx-auto w-full max-w-[320px]">
        {source ? (
          /* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL built in the browser and changing on every keystroke; there is nothing for next/image to fetch or optimise */
          <img
            src={source}
            alt={`The crest card for ${name.trim()}: a maze generated from the name.`}
            width={CREST_CARD.width}
            height={CREST_CARD.height}
            className="h-auto w-full rounded-2xl shadow-lg"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl border border-dashed border-ras-gray/30 p-6 text-center text-sm text-ras-gray dark:border-white/20 dark:text-white/60">
            Your crest appears here as you type.
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="crest-name"
          className="block font-display text-sm font-bold uppercase tracking-widest text-ras-purple dark:text-white"
        >
          Your team name
        </label>
        <input
          id="crest-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setStatus(null);
          }}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          placeholder="Maze Mice"
          className="mt-2 w-full rounded-lg border border-ras-gray/30 bg-[var(--color-bg)] px-4 py-3 text-base text-[var(--color-fg)] dark:border-white/20"
        />
        <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
          The maze is built from the letters of the name, so two teams never get the same one, and
          yours is the same every time you come back to it. You do not have to be registered to
          take one.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!ready}
            className="min-h-[44px] rounded-full bg-ras-purple px-5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            Save the card
          </button>
          <Link
            href={registerHref}
            className="inline-flex min-h-[44px] items-center rounded-full border border-ras-purple/40 px-5 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/30 dark:text-white"
          >
            Register this team
          </Link>
        </div>

        {status && (
          <p role="status" className="mt-3 text-sm text-ras-purple dark:text-white">
            {status}
          </p>
        )}

        <p className="mt-3 text-xs text-ras-gray dark:text-white/55">
          On a phone you can also press and hold the card to save it.
        </p>
      </div>
    </div>
  );
}
