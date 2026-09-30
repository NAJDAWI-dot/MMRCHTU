import type { Metadata } from "next";
import { requireSection } from "@/lib/admin-access";
import { loadCompetition } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { loadQueue } from "@/lib/day-queue";
import { competitionDayKey, qualifyingSlot } from "@/lib/match-results";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { drawnClock, minutesBetween } from "@/lib/time-shift";
import { DrawBoard, type DrawCell } from "./DrawBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The draw", robots: { index: false } };

/**
 * The qualifying draw, big: every team in running order with its time, for
 * the projector or a second screen at the desk. It follows the call queue as
 * the day goes, and holds the controls for moving the times when the day
 * slips. Opened from the Qualifying desk with "Show the draw".
 */
export default async function DrawPage() {
  await requireSection("/day/hq/scoring");
  const [state, config, queue] = await Promise.all([loadCompetition(), getCompetitionDayConfig(), loadQueue()]);
  const day = competitionDayKey(config.eventDate);
  const slotMinutes = config.runSlotMinutes || 10;
  const now = queue.active ? queue.queue.now?.id : undefined;
  const onDeck = queue.active ? queue.queue.onDeck?.id : undefined;
  const inHole = queue.active ? queue.queue.inHole?.id : undefined;

  const cells: DrawCell[] = state.competitors
    .filter((team) => team.runOrder !== null)
    .sort((a, b) => a.runOrder! - b.runOrder!)
    .map((team) => {
      const at = qualifyingSlot(team, config, day);
      const slot = at ? clockTime(at) : "";
      const drawn = config.runOrderStart ? drawnClock(config.runOrderStart, slotMinutes, team.runOrder!) : null;
      const shift = slot && drawn ? (minutesBetween(drawn, slot) ?? 0) : 0;
      return {
        id: team.id,
        order: team.runOrder!,
        name: team.name,
        code: team.teamCode,
        slot,
        shift,
        state: !team.eligible
          ? "out"
          : team.id === now
            ? "now"
            : team.id === onDeck
              ? "next"
              : team.id === inHole
                ? "after"
                : team.standing?.recorded
                  ? "ran"
                  : "waiting",
      };
    });

  return (
    <DrawBoard
      cells={cells}
      start={config.runOrderStart}
      slotMinutes={slotMinutes}
      locked={state.qualifyingStatus === "LOCKED"}
      shifted={cells.filter((cell) => cell.shift !== 0).length}
    />
  );
}
