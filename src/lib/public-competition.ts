import { cache } from "react";
import { loadCompetition } from "@/lib/competition";
import { redactCompetition, revealOf } from "@/lib/reveal";
import { getCompetitionDayConfig } from "@/lib/site-config";

/**
 * The competition as the day site and the hall screen show it: everything the
 * desks see, less whatever the organisers are holding back (see reveal.ts).
 * Every public page reads this, never loadCompetition, so nothing hidden can
 * leak through a page that forgot to check.
 */
export const loadPublicCompetition = cache(async () => {
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  return redactCompetition(state, revealOf(config));
});
