"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";
import { requireSection } from "@/lib/admin-access";
import { parseSlotLines } from "@/lib/day-slots";
import { refreshDaySite } from "@/lib/day-refresh";

/**
 * Reads the datetime-local field that drives the countdown.
 *
 * Cleared or unparseable means null — no date rather than a wrong one, since
 * the countdown simply hides itself when there is nothing to count to.
 */
function parseEventDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function updateCompetitionDay(formData: FormData) {
  await requireSection("/admin/competition-day");

  const data = {
    status: parseStatus(formData.get("status")),
    headline: String(formData.get("headline") ?? "").trim() || "Competition Day",
    intro: String(formData.get("intro") ?? "").trim(),
    comingSoonText:
      String(formData.get("comingSoonText") ?? "").trim() || "Details will be released as soon as possible.",
    dateText: String(formData.get("dateText") ?? "").trim(),
    venue: String(formData.get("venue") ?? "").trim(),
    details: String(formData.get("details") ?? "").trim(),
    eventDate: parseEventDate(formData.get("eventDate")),
  };

  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/competition-day");
  revalidatePath("/admin/competition-day");
  // The site menu shows or hides the Competition Day link based on this status,
  // and the menu lives in the root layout — so the layout cache has to go too.
  revalidatePath("/", "layout");
}

export interface RunningOrderState {
  ok: boolean;
  message: string | null;
}

/**
 * The day's running order, replaced whole from the text box: one line per
 * item, "09:00 - 09:45 | Check-in | Main hall | Bring your robot". The day
 * site's schedule and the competition day page both follow it.
 *
 * Refuses the lot if any line cannot be read, naming the lines, rather than
 * saving a running order with a gap in it nobody noticed.
 */
export async function saveRunningOrder(_previous: RunningOrderState, formData: FormData): Promise<RunningOrderState> {
  await requireSection("/admin/competition-day");

  const { slots, bad } = parseSlotLines(String(formData.get("lines") ?? ""));
  if (bad.length) {
    return {
      ok: false,
      message: `Line${bad.length === 1 ? "" : "s"} ${bad.join(", ")} ${bad.length === 1 ? "does" : "do"} not start with a time. Nothing was saved.`,
    };
  }

  await prisma.$transaction([
    prisma.daySlot.deleteMany({}),
    prisma.daySlot.createMany({ data: slots.map((slot, index) => ({ ...slot, sortOrder: index })) }),
  ]);

  revalidatePath("/competition-day");
  revalidatePath("/admin/competition-day");
  refreshDaySite();
  return {
    ok: true,
    message: slots.length
      ? `Saved ${slots.length} line${slots.length === 1 ? "" : "s"}. The day site's schedule follows it now.`
      : "Cleared. The day site falls back to the season schedule's events for the day.",
  };
}
