import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/seo/OgCard";

// Edge, not Node — see the note in OgCard, where the reason lives.
export const runtime = "edge";

export const alt = "The MMRC 26 schedule";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="MMRC 26"
        title="Schedule"
        subtitle="Every key date, in order"
        footnote="Subscribe and it stays current"
        seed={314}
      />
    ),
    size,
  );
}
