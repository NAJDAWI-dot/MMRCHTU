"use server";

import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { parseInspection } from "@/lib/bracket";
import type { DeskState } from "../state";

/** One team's row on the check-in desk. */
export async function saveTeamDay(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection("/admin/day/check-in");

  const registrationId = String(formData.get("registrationId") ?? "");
  const team = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, teamName: true, dayStatus: true },
  });
  if (!team) return { ok: false, message: "That team is gone. Reload the page." };

  const checkedIn = formData.get("checkedIn") === "on";
  const wasIn = !!team.dayStatus?.checkedInAt;

  const data = {
    // Keep the original arrival time when a row is re-saved; clear it only
    // when the box is unticked.
    checkedInAt: checkedIn ? (team.dayStatus?.checkedInAt ?? new Date()) : null,
    checkedInBy: checkedIn ? (wasIn ? (team.dayStatus?.checkedInBy ?? admin.username) : admin.username) : "",
    inspection: parseInspection(formData.get("inspection")),
    inspectionNote: String(formData.get("inspectionNote") ?? "").trim().slice(0, 200),
    robotName: String(formData.get("robotName") ?? "").trim().slice(0, 60),
    pit: String(formData.get("pit") ?? "").trim().slice(0, 20),
    withdrawn: formData.get("withdrawn") === "on",
  };

  await prisma.teamDayStatus.upsert({
    where: { registrationId },
    update: data,
    create: { registrationId, ...data },
  });
  refreshDaySite();
  return { ok: true, message: `${team.teamName} saved.` };
}
