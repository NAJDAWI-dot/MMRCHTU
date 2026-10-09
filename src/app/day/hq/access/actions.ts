"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/admin-access";
import { parseAudience } from "@/lib/day-access";
import { refreshDaySite } from "@/lib/day-refresh";
import { parseDeveloperMessage } from "@/lib/wrap-up";
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

/**
 * The competition is over, or, undone, not quite yet. Clears the whole site:
 * the homepage, the menu and the register page all change with it. The day
 * site keeps whoever it was open to, as the record of the day.
 */
export async function setWrapUp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSection(SECTION);
  const wrapUp = formData.get("wrapUp") === "on";
  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: { wrapUp },
    create: { id: "singleton", wrapUp },
  });
  revalidatePath("/", "layout");
  refreshDaySite();
  return {
    ok: true,
    message: wrapUp
      ? "Done. mmrchtu.tech now opens on the thank-you page, and registration is closed."
      : "Undone. The site is back to how it was before.",
  };
}

/** The developer's letter on the thank-you page. Empty goes back to the draft. */
export async function saveDeveloperMessage(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSection(SECTION);
  const developerMessage = parseDeveloperMessage(formData.get("message"));
  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: { developerMessage },
    create: { id: "singleton", developerMessage },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: developerMessage ? "Saved. It is on the thank-you page." : "Cleared. The thank-you page shows the draft." };
}
