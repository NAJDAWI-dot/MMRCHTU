import { cache } from "react";
import { loadCompetition } from "@/lib/competition";
import { clockTime, dayKey, runningDayKey } from "@/lib/day-mode";
import { zonedInstant } from "@/lib/day-slots";
import { buildQueue, estimateCall, placeOf, type QueueEntry, type QueuePlace, type RunQueue } from "@/lib/run-queue";
import { getCompetitionDayConfig } from "@/lib/site-config";

export interface QueueView {
  /**
   * Whether there is a queue to show: the order is drawn and qualifying is
   * still open. Once the bracket is drawn the knockout's own matches take over.
   */
  active: boolean;
  queue: RunQueue;
  entries: QueueEntry[];
  calledAt: Date | null;
  slotMinutes: number;
  /** "about 14:20" for a team still to run, "" for anyone else. */
  etaOf: (id: string) => string;
  placeOf: (id: string) => QueuePlace | null;
}

/**
 * The call queue with everything the pages around it need, read once per
 * request on top of loadCompetition, which every page showing it loads anyway.
 */
export const loadQueue = cache(async (now: Date = new Date()): Promise<QueueView> => {
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  const entries: QueueEntry[] = state.competitors.map((team) => ({
    id: team.id,
    name: team.name,
    runOrder: team.runOrder,
    eligible: team.eligible,
    ran: !!team.standing?.recorded,
  }));
  const queue = buildQueue(entries, config.queueTeamId);
  const slotMinutes = config.runSlotMinutes || 10;

  // Before the first call the drawn slot times are the best guess there is.
  const day = config.eventDate ? dayKey(config.eventDate) : runningDayKey(now);
  const start = config.runOrderStart ? zonedInstant(day, config.runOrderStart) : null;
  const drawnSlot = (order: number | null) => (start && order ? new Date(start.getTime() + (order - 1) * slotMinutes * 60_000) : null);

  const etaOf = (id: string) => {
    const index = queue.upcoming.findIndex((entry) => entry.id === id);
    if (index === -1) return "";
    if (!queue.now) {
      const slot = drawnSlot(queue.upcoming[index]!.runOrder);
      return slot ? `about ${clockTime(slot)}` : "";
    }
    return `about ${clockTime(estimateCall(config.queueCalledAt, now, slotMinutes, index))}`;
  };

  return {
    active: queue.total > 0 && state.qualifyingStatus !== "LOCKED",
    queue,
    entries,
    calledAt: config.queueCalledAt,
    slotMinutes,
    etaOf,
    placeOf: (id: string) => placeOf(queue, entries, id),
  };
});
