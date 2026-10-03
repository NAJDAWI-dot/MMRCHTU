"use server";

import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { parseInspection } from "@/lib/bracket";
import { parseCodeList, planCodes, type CodeTeam } from "@/lib/team-codes";
import type { CodeListState, DeskState } from "../state";

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
    teamCode: String(formData.get("teamCode") ?? "").trim().toUpperCase().slice(0, 12),
    withdrawn: formData.get("withdrawn") === "on",
  };

  await prisma.teamDayStatus.upsert({
    where: { registrationId },
    update: data,
    create: { registrationId, ...data },
  });
  refreshDaySite();
  // Saved either way, since the desk may be half way through swapping two
  // teams' codes; but said out loud, so a typo does not go unnoticed.
  const twin = data.teamCode
    ? await prisma.teamDayStatus.findFirst({
        where: { teamCode: data.teamCode, registrationId: { not: registrationId } },
        select: { registration: { select: { teamName: true } } },
      })
    : null;
  if (twin) return { ok: false, message: `${team.teamName} saved, but ${twin.registration.teamName} already has the code ${data.teamCode}.` };
  return { ok: true, message: `${team.teamName} saved.` };
}

/** The confirmed teams, with their codes now and their members' numbers. */
async function codeTeams(): Promise<CodeTeam[]> {
  const rows = await prisma.registration.findMany({
    where: { status: "CONFIRMED" },
    select: { id: true, teamName: true, dayStatus: { select: { teamCode: true } }, members: { select: { whatsapp: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.teamName.trim(),
    code: row.dayStatus?.teamCode ?? "",
    phones: row.members.map((member) => member.whatsapp),
  }));
}

const NO_CODES = "No codes found. Paste the rows with the code first (A0) and the team name after it.";

/** Reads a pasted team list and says what saving it would change. Writes nothing. */
export async function checkCodeList(_previous: CodeListState, formData: FormData): Promise<CodeListState> {
  await requireSection(SECTION);
  const list = String(formData.get("list") ?? "").slice(0, 200_000);
  const rows = parseCodeList(list);
  if (!rows.length) return { ok: false, message: NO_CODES, plan: null, list: "" };
  return { ok: true, message: null, plan: planCodes(rows, await codeTeams()), list };
}

/**
 * Saves the codes from a checked list. The list is matched again here rather
 * than trusting the browser's copy of the check; a team on the list that holds
 * none of its codes keeps whatever code it has.
 */
export async function saveCodeList(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const rows = parseCodeList(String(formData.get("list") ?? "").slice(0, 200_000));
  if (!rows.length) return { ok: false, message: NO_CODES };
  const plan = planCodes(rows, await codeTeams());
  if (!plan.assign.length) return { ok: false, message: "No team on the list matched, so nothing was saved." };

  await prisma.$transaction([
    ...plan.clear.map((team) => prisma.teamDayStatus.update({ where: { registrationId: team.teamId }, data: { teamCode: "" } })),
    ...plan.assign.map((row) =>
      prisma.teamDayStatus.upsert({
        where: { registrationId: row.teamId },
        update: { teamCode: row.code },
        create: { registrationId: row.teamId, teamCode: row.code },
      }),
    ),
  ]);
  refreshDaySite();
  const left = plan.unmatched.length ? ` ${plan.unmatched.length} row${plan.unmatched.length === 1 ? "" : "s"} did not match; set those by hand below.` : "";
  return { ok: true, message: `Saved ${plan.assign.length} team code${plan.assign.length === 1 ? "" : "s"}.${left}` };
}
