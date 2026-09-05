import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/seo/OgCard";

// Edge, not Node — see the note in OgCard, where the reason lives.
export const runtime = "edge";

export const alt = "Pac Mouse, the MMRC 26 maze game";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="MMRC 26"
        title="Pac Mouse"
        subtitle="The maze game"
        footnote="Mind the cheese"
        seed={1984}
      />
    ),
    size,
  );
}
