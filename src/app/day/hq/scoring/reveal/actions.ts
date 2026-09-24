"use server";

import { requireSection } from "@/lib/admin-access";
import { phaseInfo } from "@/lib/bracket";
import { refreshDaySite } from "@/lib/day-refresh";
import { prisma } from "@/lib/prisma";
import { REVEAL_PHASES, parsePhaseList, serializePhaseList } from "@/lib/reveal";
import { getCompetitionDayConfig } from "@/lib/site-config";
import type { DeskState } from "../../state";

const SECTION = "/day/hq/scoring/reveal";

const save = (data: { hiddenResults?: string; hiddenAdvance?: string; lastReveal?: string }) =>
  prisma.competitionDayConfig.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });

/**
 * Shows or holds back one thing for one phase: its results ("results") or
 * who went through from it ("advance"). The desks keep seeing everything.
 */
export async function setReveal(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const phase = Number(formData.get("phase"));
  const kind = formData.get("kind") === "advance" ? "advance" : "results";
  const show = formData.get("show") === "yes";
  if (!(REVEAL_PHASES as readonly number[]).includes(phase)) return { ok: false, message: "That is not a phase." };

  const config = await getCompetitionDayConfig();
  const field = kind === "advance" ? "hiddenAdvance" : "hiddenResults";
  const hidden = parsePhaseList(config[field]).filter((item) => item !== phase);
  if (!show) hidden.push(phase);
  // A reveal is a moment: the hall screen plays it and the day site says so.
  await save({ [field]: serializePhaseList(hidden), ...(show ? { lastReveal: `${phase}|${kind}|${Date.now()}` } : {}) });
  refreshDaySite();

  const name = phaseInfo(phase).name;
  const what = kind === "advance" ? `who went through from the ${name}` : `${name} scores and runs`;
  return { ok: true, message: show ? `Revealed: ${what} are on the day site and the hall screen.` : `Hidden: ${what} are held back.` };
}

/** Holds everything back, or shows everything, in one go. */
export async function setRevealAll(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const show = formData.get("show") === "yes";
  const all = serializePhaseList([...REVEAL_PHASES]);
  await save({ hiddenResults: show ? "" : all, hiddenAdvance: show ? "" : all, ...(show ? { lastReveal: `all|all|${Date.now()}` } : {}) });
  refreshDaySite();
  return {
    ok: true,
    message: show ? "Everything is revealed on the day site and the hall screen." : "Everything is held back. Only the desks can see the results.",
  };
}
