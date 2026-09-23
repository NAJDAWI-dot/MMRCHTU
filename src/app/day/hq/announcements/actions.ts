"use server";

import { prisma } from "@/lib/prisma";
import { parseAnnouncement } from "@/lib/day-mode";
import { parseTone } from "@/lib/day-alerts";
import { refreshDaySite } from "@/lib/day-refresh";
import { requireSection } from "@/lib/admin-access";
import type { ActionState } from "./state";

const SECTION = "/day/hq/announcements";

type Fields = { title: string; body: string; tone: string; isAlert: boolean; isPinned: boolean; isPublished: boolean };

function fields(formData: FormData): { data: Fields } | { error: string } {
  const body = parseAnnouncement(formData.get("body"));
  if (!body) return { error: "Write the announcement first." };
  return {
    data: {
      title: String(formData.get("title") ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      body,
      tone: parseTone(formData.get("tone")),
      isAlert: formData.get("isAlert") === "on",
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
  refreshDaySite();
  return {
    ok: true,
    message: !parsed.data.isPublished
      ? "Saved as a draft. Turn on “Show it” to post it."
      : parsed.data.isAlert
        ? "Posted. It pops up on every open day site within half a minute, then stays in the top bar."
        : "Posted to the news.",
  };
}

/**
 * Saving an alert again, even unchanged, counts as changing it: it pops up
 * once more for everyone who had dismissed it. That is the point of editing an
 * alert, and the only way to repeat one.
 */
export async function updateAnnouncement(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSection(SECTION);

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "That row has lost its id. Reload the page and try again." };

  const parsed = fields(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  await prisma.dayAnnouncement.update({ where: { id }, data: parsed.data });
  refreshDaySite();
  return { ok: true, message: parsed.data.isAlert && parsed.data.isPublished ? "Saved. It pops up again for everyone." : "Saved." };
}

/** Takes an alert out of the pop-up and the top bar, and leaves it in the news. */
export async function clearAlert(formData: FormData) {
  await requireSection(SECTION);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.dayAnnouncement.updateMany({ where: { id }, data: { isAlert: false } });
  refreshDaySite();
}

/** No validation to fail: either the row is there or somebody else deleted it. */
export async function deleteAnnouncement(formData: FormData) {
  await requireSection(SECTION);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing announcement id.");

  await prisma.dayAnnouncement.deleteMany({ where: { id } });
  refreshDaySite();
}
