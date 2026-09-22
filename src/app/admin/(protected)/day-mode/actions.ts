"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAnnouncement } from "@/lib/day-mode";
import type { ActionState } from "./state";

/**
 * Flips the whole site between the normal site and the competition day site.
 *
 * Clears every cached page, not only the homepage: the menu lives in the root
 * layout, Register and Rules have to start (or stop) answering "not found", and
 * the homepage cards drop the Rules link. One revalidation of the root layout
 * reaches all of them.
 */
export async function setDayMode(formData: FormData) {
  await requireAdmin();

  const dayMode = String(formData.get("dayMode") ?? "") === "on";

  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: { dayMode },
    create: { id: "singleton", dayMode },
  });

  revalidatePath("/", "layout");
}

function refreshed() {
  revalidatePath("/");
  revalidatePath("/day-preview");
  revalidatePath("/admin/day-mode");
}

function fields(formData: FormData): { data: { body: string; isPinned: boolean; isPublished: boolean } } | { error: string } {
  const body = parseAnnouncement(formData.get("body"));
  if (!body) return { error: "Write the announcement first." };
  return {
    data: {
      body,
      isPinned: formData.get("isPinned") === "on",
      isPublished: formData.get("isPublished") === "on",
    },
  };
}

export async function createAnnouncement(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = fields(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  await prisma.dayAnnouncement.create({ data: parsed.data });
  refreshed();
  return {
    ok: true,
    message: parsed.data.isPublished
      ? "Posted. Phones on the day site pick it up within a minute."
      : "Saved as a draft. Tick “Show it” to post it.",
  };
}

export async function updateAnnouncement(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "That row has lost its id. Reload the page and try again." };

  const parsed = fields(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  await prisma.dayAnnouncement.update({ where: { id }, data: parsed.data });
  refreshed();
  return { ok: true, message: "Saved." };
}

/** No validation to fail: either the row is there or somebody else deleted it. */
export async function deleteAnnouncement(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing announcement id.");

  await prisma.dayAnnouncement.deleteMany({ where: { id } });
  refreshed();
}

