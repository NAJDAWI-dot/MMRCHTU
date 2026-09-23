"use server";

import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { parseInspection } from "@/lib/bracket";
import type { DeskState } from "../state";

const SECTION = "/day/hq/check-in";

/**
 * One tap at the desk: the team is here, or it is not after all.
 *
 * Arriving marks every member present when nobody has been ticked yet, which
 * is the usual case (the whole team walks up together); the desk can untick
 * anyone who is missing afterwards. Undoing keeps the other details, so a
 * mis-tap costs nothing.
 */
export async function quickArrive(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);
  const registrationId = String(formData.get("registrationId") ?? "");
  const arrive = formData.get("arrive") === "1";
  const team = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, teamName: true, dayStatus: true, members: { select: { id: true } } },
  });
  if (!team) return { ok: false, message: "That team is gone. Reload the page." };

  const everyone = team.members.map((member) => member.id).join(",");
  const data = arrive
    ? {
        checkedInAt: team.dayStatus?.checkedInAt ?? new Date(),
        checkedInBy: team.dayStatus?.checkedInBy || admin.username,
        presentIds: team.dayStatus?.presentIds || everyone,
      }
    : { checkedInAt: null, checkedInBy: "" };

  await prisma.teamDayStatus.upsert({
    where: { registrationId },
    update: data,
    create: { registrationId, ...data },
  });
  refreshDaySite();
  return { ok: true, message: arrive ? `${team.teamName} checked in.` : `${team.teamName} is no longer checked in.` };
}

/** Everything the desk records about a team, from its expanded row. */
export async function saveTeamDay(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);

  const registrationId = String(formData.get("registrationId") ?? "");
  const team = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, teamName: true, dayStatus: true, members: { select: { id: true } } },
  });
  if (!team) return { ok: false, message: "That team is gone. Reload the page." };

  const checkedIn = formData.get("checkedIn") === "on";
  const wasIn = !!team.dayStatus?.checkedInAt;
  const memberIds = new Set(team.members.map((member) => member.id));
  const present = formData
    .getAll("present")
    .map(String)
    .filter((id) => memberIds.has(id));

  const data = {
    // Keep the original arrival time when a row is re-saved; clear it only
    // when the switch is turned off.
    checkedInAt: checkedIn ? (team.dayStatus?.checkedInAt ?? new Date()) : null,
    checkedInBy: checkedIn ? (wasIn ? (team.dayStatus?.checkedInBy ?? admin.username) : admin.username) : "",
    presentIds: present.join(","),
    badges: formData.get("badges") === "on",
    deskNote: String(formData.get("deskNote") ?? "").trim().slice(0, 300),
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
