"use server";

import { prisma } from "@/lib/prisma";
import { parseAnnouncement } from "@/lib/day-mode";
import { refreshDaySite } from "@/lib/day-refresh";
import { requireSection } from "@/lib/admin-access";
import type { ActionState } from "./state";

const SECTION = "/admin/day/announcements";

function refreshed() {
  refreshDaySite();
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
  await requireSection(SECTION);

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
  await requireSection(SECTION);

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
  await requireSection(SECTION);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing announcement id.");

  await prisma.dayAnnouncement.deleteMany({ where: { id } });
  refreshed();
}

