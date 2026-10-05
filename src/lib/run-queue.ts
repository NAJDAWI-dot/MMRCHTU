/**
 * The qualifying call queue: who is on the mazes, who is on deck, who is in
 * the hole.
 *
 * With more than one maze on the floor, each maze is a lane: a team runs on
 * its own qualifying maze, and a call puts the next team of every lane on its
 * maze at once (two mazes, two teams). With one maze it is one lane, one team
 * at a time.
 *
 * Only the teams on the mazes are stored (CompetitionDayConfig.queueTeamId,
 * ids joined with "+"). Everything else is read off the drawn running order
 * and the match sheets, so the queue can never disagree with the qualifying
 * desk: a team drops out of it the moment its sheet is saved, and a withdrawn
 * team the moment it is withdrawn.
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
  /** The organisers' code for the team, when it has one. */
  code?: string;
  /** The maze it runs on, when the Mazes desk (or the draw) has said. */
  maze?: string;
}

export interface RunQueue {
  /** The first team on a maze, or null before anyone is called. */
  now: QueueEntry | null;
  /** Every team on a maze now, one per lane, in maze order. */
  nowGroup: QueueEntry[];
  /** Every team still to run, call by call: the next call's teams first. */
  upcoming: QueueEntry[];
  onDeck: QueueEntry | null;
  /** The teams the next call puts on the mazes. */
  deckGroup: QueueEntry[];
  inHole: QueueEntry | null;
  /** The teams of the call after that. */
  holeGroup: QueueEntry[];
  /** Teams in the running order, and how many of them have run. */
  total: number;
  ran: number;
  /** How many mazes run at once. */
  lanes: number;
  /** How many calls come before a waiting team's own, by id. */
  callsAhead: Map<string, number>;
}

const byOrder = (a: QueueEntry, b: QueueEntry) => (a.runOrder ?? 0) - (b.runOrder ?? 0);

/** The stored teams on the mazes: "a+b" to ["a", "b"]. */
export function calledIds(current: string): string[] {
  return current
    .split("+")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Which lane a team is in: its maze's place in the list, or, for a team with
 * no maze (or one not on the list), its place in the order taken round the
 * mazes, the way the draw shares them out.
 */
export function laneOf(entry: QueueEntry, mazes: readonly string[]): number {
  const lanes = Math.max(1, mazes.length);
  if (lanes === 1) return 0;
  const at = entry.maze ? mazes.findIndex((maze) => maze.toLowerCase() === entry.maze!.toLowerCase()) : -1;
  if (at >= 0) return at;
  return Math.max(0, (entry.runOrder ?? 1) - 1) % lanes;
}

/**
 * The queue as it stands.
 *
 * In each lane the teams after the one on its maze come first, then any
 * earlier team that still has not run: a team that was not at the table when
 * it was called is called again once the rest of its lane have been, which is
 * how a hall runs it.
 */
export function buildQueue(entries: readonly QueueEntry[], current: string, mazes: readonly string[] = []): RunQueue {
  const lanes = Math.max(1, mazes.length);
  const lineup = entries.filter((entry) => entry.runOrder !== null).sort(byOrder);
  const ids = calledIds(current);
  const nowGroup = lineup.filter((entry) => ids.includes(entry.id)).sort((a, b) => laneOf(a, mazes) - laneOf(b, mazes) || byOrder(a, b));
  // A lane with nobody on its maze carries on from where the others are.
  const furthest = Math.max(0, ...nowGroup.map((entry) => entry.runOrder ?? 0));

  const perLane: QueueEntry[][] = [];
  for (let lane = 0; lane < lanes; lane++) {
    const onMaze = nowGroup.find((entry) => laneOf(entry, mazes) === lane);
    const at = onMaze?.runOrder ?? furthest;
    const waiting = lineup.filter((entry) => laneOf(entry, mazes) === lane && entry.eligible && !entry.ran && !ids.includes(entry.id));
    perLane.push([...waiting.filter((entry) => entry.runOrder! > at), ...waiting.filter((entry) => entry.runOrder! < at)]);
  }

  const upcoming: QueueEntry[] = [];
  const callsAhead = new Map<string, number>();
  const longest = Math.max(0, ...perLane.map((lane) => lane.length));
  for (let call = 0; call < longest; call++) {
    for (const lane of perLane) {
      const entry = lane[call];
      if (!entry) continue;
      upcoming.push(entry);
      callsAhead.set(entry.id, call);
    }
  }
  const groupAt = (call: number) => perLane.flatMap((lane) => (lane[call] ? [lane[call]!] : []));
  const deckGroup = groupAt(0);
  const holeGroup = groupAt(1);

  return {
    now: nowGroup[0] ?? null,
    nowGroup,
    upcoming,
    onDeck: deckGroup[0] ?? null,
    deckGroup,
    inHole: holeGroup[0] ?? null,
    holeGroup,
    total: lineup.length,
    ran: lineup.filter((entry) => entry.ran).length,
    lanes,
    callsAhead,
  };
}

/** The teams "Call next" puts on the mazes: empty when nobody is left. */
export function nextToCall(entries: readonly QueueEntry[], current: string, mazes: readonly string[] = []): QueueEntry[] {
  return buildQueue(entries, current, mazes).deckGroup;
}

/** What a call stores: the teams' ids, joined. */
export const groupKey = (group: readonly QueueEntry[]) => group.map((entry) => entry.id).join("+");

/**
 * The teams on the mazes after one team is called out of turn: it goes on its
 * own maze, in place of whoever was there; the other mazes carry on.
 */
export function callOne(entries: readonly QueueEntry[], current: string, mazes: readonly string[], id: string): string {
  const chosen = entries.find((entry) => entry.id === id);
  if (!chosen) return current;
  const lane = laneOf(chosen, mazes);
  const others = calledIds(current).filter((other) => {
    const entry = entries.find((item) => item.id === other);
    return !!entry && other !== id && laneOf(entry, mazes) !== lane;
  });
  return [...others, id].join("+");
}

/** How many calls "Back one" can undo. */
export const HISTORY_MAX = 20;

/**
 * The call history after a new call: the teams that were on the mazes go on
 * the end, as one entry ("a+b"). Stored comma-separated, oldest first, capped.
 */
export function pushHistory(history: string, previousId: string): string {
  const ids = history.split(",").filter(Boolean);
  if (previousId) ids.push(previousId);
  return ids.slice(-HISTORY_MAX).join(",");
}

/**
 * What "Back one" does: the teams that were on the mazes before the current
 * ones, and the history without them. Null when there is nothing to go back to.
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
  /** Further back: `ahead` calls go before its own. */
  | { kind: "waiting"; ahead: number }
  | { kind: "ran" };

/** Where one team stands in the queue, or null for a team not in it at all. */
export function placeOf(queue: RunQueue, entries: readonly QueueEntry[], id: string): QueuePlace | null {
  if (queue.nowGroup.some((entry) => entry.id === id)) return { kind: "now" };
  const calls = queue.callsAhead.get(id);
  if (calls === 0) return { kind: "on-deck" };
  if (calls === 1) return { kind: "in-hole" };
  if (calls !== undefined) return { kind: "waiting", ahead: calls };
  const entry = entries.find((item) => item.id === id);
  if (entry?.runOrder != null && entry.ran) return { kind: "ran" };
  return null;
}

/**
 * Roughly when a team `ahead` calls back will be called: one slot per call
 * ahead of it, counted from when the teams on the mazes were called. A guess,
 * and shown as one ("about 14:20"), but a better one than the drawn slot time
 * once the day has slipped.
 */
export function estimateCall(calledAt: Date | null, now: Date, slotMinutes: number, ahead: number): Date {
  const from = calledAt && calledAt.getTime() <= now.getTime() ? calledAt : now;
  const estimate = new Date(from.getTime() + (ahead + 1) * slotMinutes * 60_000);
  // A team is never called in the past, however long the one on the maze runs over.
  return estimate.getTime() < now.getTime() ? now : estimate;
}
