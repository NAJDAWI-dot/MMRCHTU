import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { GUIDE_DEFAULTS, parseGuide, type GuideSlug } from "@/lib/day-guides";

/** A guide as saved on the Media desk, or its original text until it is. */
export const loadGuide = cache(async (slug: GuideSlug) => {
  const row = await prisma.dayGuide.findUnique({ where: { slug } });
  const fallback = GUIDE_DEFAULTS[slug];
  return {
    title: row?.title || fallback.title,
    kicker: fallback.kicker,
    blocks: parseGuide(row?.body ?? fallback.body),
  };
});
