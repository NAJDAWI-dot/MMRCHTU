/**
 * The qualifying call queue: who is on the maze, who is on deck, who is in
 * the hole.
 *
 * Only the team on the maze is stored (CompetitionDayConfig.queueTeamId).
 * Everything else is read off the drawn running order and the match sheets,
 * so the queue can never disagree with the qualifying desk: a team drops out
 * of it the moment its sheet is saved, and a withdrawn team the moment it is
 * withdrawn.
 *
 * Free of Prisma and of Next so it can be tested on its own.
 */

export interface QueueEntry {
  id: string;
  name: string;
  /** Place in the running order, or null for a team that was not drawn. */
  runOrder: number | null;
  /** Withdrawn teams and teams that failed inspection are skipped. */
  eligible: boolean;
  /** Whether the team has a match sheet, so has run. */
  ran: boolean;
}

export interface RunQueue {
  /** The team on the maze, or null before anyone is called. */
  now: QueueEntry | null;
  /** Every team still to run, in the order they will be called. */
  upcoming: QueueEntry[];
  onDeck: QueueEntry | null;
  inHole: QueueEntry | null;
  /** Teams in the running order, and how many of them have run. */
  total: number;
  ran: number;
}

const byOrder = (a: QueueEntry, b: QueueEntry) => (a.runOrder ?? 0) - (b.runOrder ?? 0);

/**
 * The queue as it stands.
 *
 * The teams after the one on the maze come first, then any earlier team that
 * still has not run: a team that was not at the table when it was called is
 * called again once the rest have been, which is how a hall runs it.
 */
export function buildQueue(entries: readonly QueueEntry[], currentId: string): RunQueue {
  const lineup = entries.filter((entry) => entry.runOrder !== null).sort(byOrder);
  const now = lineup.find((entry) => entry.id === currentId) ?? null;
  const waiting = lineup.filter((entry) => entry.eligible && !entry.ran && entry.id !== now?.id);
  const at = now?.runOrder ?? 0;
  const upcoming = [...waiting.filter((entry) => entry.runOrder! > at), ...waiting.filter((entry) => entry.runOrder! < at)];

  return {
    now,
    upcoming,
    onDeck: upcoming[0] ?? null,
    inHole: upcoming[1] ?? null,
    total: lineup.length,
    ran: lineup.filter((entry) => entry.ran).length,
  };
}

/** The team "Call next" puts on the maze, or null when nobody is left. */
export function nextToCall(entries: readonly QueueEntry[], currentId: string): QueueEntry | null {
  return buildQueue(entries, currentId).onDeck;
}

/** How many calls "Back one" can undo. */
export const HISTORY_MAX = 20;

/**
 * The call history after a new call: the team that was on the maze goes on
 * the end. Stored as ids, comma-separated, oldest first, and capped.
 */
export function pushHistory(history: string, previousId: string): string {
  const ids = history.split(",").filter(Boolean);
  if (previousId) ids.push(previousId);
  return ids.slice(-HISTORY_MAX).join(",");
}

/**
 * What "Back one" does: the team that was on the maze before the current one,
 * and the history without it. Null when there is nothing to go back to.
 *
 * The history rather than the running order, so a call out of turn, or a
 * skipped team coming round again, is undone to whoever was really there.
 */
export function popHistory(history: string): { id: string; history: string } | null {
  const ids = history.split(",").filter(Boolean);
  const id = ids.pop();
  return id ? { id, history: ids.join(",") } : null;
}

export type QueuePlace =
  | { kind: "now" }
  | { kind: "on-deck" }
  | { kind: "in-hole" }
  /** Further back: `ahead` teams go before it. */
  | { kind: "waiting"; ahead: number }
  | { kind: "ran" };

/** Where one team stands in the queue, or null for a team not in it at all. */
export function placeOf(queue: RunQueue, entries: readonly QueueEntry[], id: string): QueuePlace | null {
  if (queue.now?.id === id) return { kind: "now" };
  const index = queue.upcoming.findIndex((entry) => entry.id === id);
  if (index === 0) return { kind: "on-deck" };
  if (index === 1) return { kind: "in-hole" };
  if (index > 1) return { kind: "waiting", ahead: index };
  const entry = entries.find((item) => item.id === id);
  if (entry?.runOrder != null && entry.ran) return { kind: "ran" };
  return null;
}

/**
 * Roughly when a team `ahead` places back will be called: one slot per team
 * ahead of it, counted from when the team on the maze was called. A guess, and
 * shown as one ("about 14:20"), but a better one than the drawn slot time once
 * the day has slipped.
 */
export function estimateCall(calledAt: Date | null, now: Date, slotMinutes: number, ahead: number): Date {
  const from = calledAt && calledAt.getTime() <= now.getTime() ? calledAt : now;
  const estimate = new Date(from.getTime() + (ahead + 1) * slotMinutes * 60_000);
  // A team is never called in the past, however long the one on the maze runs over.
  return estimate.getTime() < now.getTime() ? now : estimate;
}
