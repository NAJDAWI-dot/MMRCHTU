import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/seo/OgCard";

/**
 * The card the site is shared as, and the fallback for every page that does
 * not declare its own.
 *
 * The layout itself now lives in OgCard, so the per-page cards and this one
 * cannot drift apart — which they would the moment the brand colours changed
 * and only one of nine files was updated.
 */

// Edge, not Node — see the note in OgCard, where the reason lives.
export const runtime = "edge";

export const alt = "MMRC 26 — the IEEE RAS HTU Micro Mouse Robot Competition";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="IEEE RAS HTU Student Chapter"
        title="MMRC 26"
        subtitle="Micro Mouse Robot Competition"
        footnote="Build a maze-solving robot. Race the clock."
        seed={20260821}
      />
    ),
    size,
  );
}
