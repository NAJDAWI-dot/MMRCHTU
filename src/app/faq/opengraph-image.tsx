import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/seo/OgCard";

// Edge, not Node — see the note in OgCard, where the reason lives.
export const runtime = "edge";

export const alt = "MMRC 26 questions and answers";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="MMRC 26"
        title="Questions"
        subtitle="Answers, and somewhere to ask"
        footnote="We reply by email"
        seed={404}
      />
    ),
    size,
  );
}
