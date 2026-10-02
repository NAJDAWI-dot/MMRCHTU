"use server";

import { requireSection } from "@/lib/admin-access";
import { JUDGED_AWARDS, judgedPick } from "@/lib/awards";
import { FINAL_ROUND, THIRD_PLACE_ROUND } from "@/lib/bracket";
import { refreshDaySite } from "@/lib/day-refresh";
import { prisma } from "@/lib/prisma";
import { parsePhaseList, serializePhaseList } from "@/lib/reveal";
import { getCompetitionDayConfig } from "@/lib/site-config";
import type { DeskState } from "../../state";

const SECTION = "/day/hq/scoring/awards";

const save = (data: Record<string, unknown>) =>
  prisma.competitionDayConfig.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });

/** The judges' four picks. A team cannot win an award and be its runner-up. */
export async function saveJudgedAwards(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const teams = new Set((await prisma.registration.findMany({ where: { status: "CONFIRMED" }, select: { id: true } })).map((row) => row.id));
  const picks = Object.fromEntries(JUDGED_AWARDS.map((award) => [award.key, judgedPick(formData.get(award.key), (id) => teams.has(id))]));

  if (picks.awardBestCode && picks.awardBestCode === picks.awardBestCodeRunnerUp) {
    return { ok: false, message: "The same team cannot win Best Code and be its runner-up." };
  }
  if (picks.awardBestDesign && picks.awardBestDesign === picks.awardBestDesignRunnerUp) {
    return { ok: false, message: "The same team cannot win Best Creative Design and be its runner-up." };
  }

  await save(picks);
  refreshDaySite();
  const set = Object.values(picks).filter(Boolean).length;
  return { ok: true, message: `Saved. ${set} of ${JUDGED_AWARDS.length} judged awards have a winner.` };
}

/**
 * Shows the awards to everyone, or takes them back. Showing them also plays
 * them on the hall screen, and reveals the final with them: the awards end
 * with the champions, so holding the final back would leave a gap.
 */
export async function revealAwards(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const show = formData.get("show") === "yes";
  if (!show) {
    await save({ awardsShown: false });
    refreshDaySite();
    return { ok: true, message: "The awards are hidden again. Only the desks can see them." };
  }
  const config = await getCompetitionDayConfig();
  const unhide = (value: string) => serializePhaseList(parsePhaseList(value).filter((phase) => phase !== FINAL_ROUND));
  await save({
    awardsShown: true,
    hiddenResults: unhide(config.hiddenResults),
    hiddenAdvance: unhide(config.hiddenAdvance),
    lastReveal: `awards|awards|${Date.now()}`,
  });
  refreshDaySite();
  return { ok: true, message: "Revealed. The awards are playing on the hall screen and are on the results page." };
}

/** Adds the third place play-off to a bracket drawn without one. */
export async function addThirdPlace(_previous: DeskState, _formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  if (!(await prisma.knockoutMatch.count())) return { ok: false, message: "Draw the bracket first." };
  await prisma.knockoutMatch.upsert({
    where: { round_slot: { round: THIRD_PLACE_ROUND, slot: 0 } },
    update: {},
    create: { round: THIRD_PLACE_ROUND, slot: 0 },
  });
  refreshDaySite();
  return { ok: true, message: "Added. The beaten semi-finalists play it, and it is on the Bracket desk." };
}
