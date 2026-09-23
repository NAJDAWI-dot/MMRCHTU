"use server";

import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { GUIDE_BODY_MAX, GUIDE_DEFAULTS, isGuideSlug } from "@/lib/day-guides";
import type { DeskState } from "../state";

export async function saveGuide(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection("/day/hq/guides");

  const slug = String(formData.get("slug") ?? "");
  if (!isGuideSlug(slug)) return { ok: false, message: "Unknown guide." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || GUIDE_DEFAULTS[slug].title;
  const body = String(formData.get("body") ?? "").replace(/\r\n?/g, "\n").trim().slice(0, GUIDE_BODY_MAX);

  await prisma.dayGuide.upsert({ where: { slug }, update: { title, body }, create: { slug, title, body } });
  refreshDaySite();
  return { ok: true, message: "Saved. The page on the day site is updated." };
}

/** Puts a guide back to the text it started with. */
export async function resetGuide(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection("/day/hq/guides");
  const slug = String(formData.get("slug") ?? "");
  if (!isGuideSlug(slug)) return { ok: false, message: "Unknown guide." };
  await prisma.dayGuide.deleteMany({ where: { slug } });
  refreshDaySite();
  return { ok: true, message: "Back to the original text." };
}
