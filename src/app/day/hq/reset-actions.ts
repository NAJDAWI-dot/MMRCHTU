"use server";

import { requireSection, rolesOf } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { SINGLETON_ID } from "@/lib/site-config";
import { RESET_WORD, type DeskState } from "./state";

/**
 * Takes the day back to the start, ready to run: after a rehearsal, or after
 * test data. Everything that happens on the day goes; everything set up for it
 * stays.
 *
 * Goes: check-ins, who is here, badges, whether each robot is available, desk
 * and robot notes, withdrawals, the judges' through or out, the qualifying
 * running order and its times, every match sheet, the bracket, the call queue
 * and what the reveal desk was holding back.
 *
 * Stays: the teams and their codes, the day's schedule, announcements,
 * photos, sponsors, volunteers, guides and every setting.
 */
export async function resetDay(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection("/day/hq");
  if (!rolesOf(admin).includes("MASTER")) return { ok: false, message: "Only the master account can reset the day." };
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== RESET_WORD) {
    return { ok: false, message: `Type ${RESET_WORD} to confirm. Nothing was reset.` };
  }

  const [statuses, sheets, matches] = await prisma.$transaction([
    prisma.teamDayStatus.updateMany({
      data: {
        checkedInAt: null,
        checkedInBy: "",
        inspection: "PENDING",
        inspectionNote: "",
        withdrawn: false,
        presentIds: "",
        badges: false,
        deskNote: "",
        runOrder: null,
        slotTime: "",
        qualifyOverride: "",
      },
    }),
    prisma.qualifyingRun.deleteMany({}),
    prisma.knockoutMatch.deleteMany({}),
    prisma.competitionDayConfig.upsert({
      where: { id: SINGLETON_ID },
      update: {
        qualifyingStatus: "NOT_SET",
        runOrderStart: "",
        runOrderDrawnAt: null,
        queueTeamId: "",
        queueCalledAt: null,
        queueHistory: "",
        hiddenResults: "",
        hiddenAdvance: "",
        lastReveal: "",
        awardBestCode: "",
        awardBestCodeRunnerUp: "",
        awardBestDesign: "",
        awardBestDesignRunnerUp: "",
        awardsShown: false,
      },
      create: { id: SINGLETON_ID },
    }),
  ]);
  refreshDaySite();
  return {
    ok: true,
    message: `The day is reset: ${statuses.count} teams back to not here yet, ${sheets.count} match sheet${sheets.count === 1 ? "" : "s"} and ${matches.count} bracket match${matches.count === 1 ? "" : "es"} removed. Ready to go.`,
  };
}
