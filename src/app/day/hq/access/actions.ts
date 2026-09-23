"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/admin-access";
import { parseAudience } from "@/lib/day-access";
import { refreshDaySite } from "@/lib/day-refresh";
import type { ActionState } from "./state";

const SECTION = "/day/hq/access";

/**
 * Who can open the day site, and whether it has taken over the homepage.
 *
 * dayMode is kept equal to "the audience is everyone", since that is what the
 * rest of the site already reads to hide Register and Rules and to hand the
 * homepage over. Clears the whole site, because the menu, the homepage and
 * every day page change with it.
 */
export async function setAudience(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSection(SECTION);

  const onlyMe = formData.get("onlyMe") === "yes";
  const audience = onlyMe ? "PRIVATE" : parseAudience(formData.get("audience"));
  const ids = formData.getAll("viewerIds").map(String).filter(Boolean);

  const existing = new Set((await prisma.adminUser.findMany({ select: { id: true } })).map((row) => row.id));
  const viewers = onlyMe ? [admin.id] : ids.filter((id) => existing.has(id));

  if (audience === "PRIVATE" && viewers.length === 0) {
    return { ok: false, message: "Pick at least one admin, or press “Only me”." };
  }

  const data = {
    dayAudience: audience,
    dayViewerIds: viewers.join(","),
    dayMode: audience === "PUBLIC",
  };
  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/", "layout");
  refreshDaySite();
  return {
    ok: true,
    message: onlyMe
      ? "Done. Only you can open the day site."
      : data.dayMode
        ? "The day site is public. mmrchtu.tech now opens on it."
        : "Saved.",
  };
}
