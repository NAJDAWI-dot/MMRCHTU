import { describe, expect, it } from "vitest";
import { HISTORY_MAX, buildQueue, estimateCall, nextToCall, placeOf, popHistory, pushHistory, type QueueEntry } from "@/lib/run-queue";

const team = (id: string, runOrder: number | null, extra: Partial<QueueEntry> = {}): QueueEntry => ({
  id,
  name: id.toUpperCase(),
  runOrder,
  eligible: true,
  ran: false,
  ...extra,
});

const names = (entries: QueueEntry[]) => entries.map((entry) => entry.id);

describe("the call queue", () => {
  const field = [team("c", 3), team("a", 1), team("d", 4), team("b", 2), team("x", null)];

  it("starts at the top of the running order before anyone is called", () => {
    const queue = buildQueue(field, "");
    expect(queue.now).toBeNull();
    expect(names(queue.upcoming)).toEqual(["a", "b", "c", "d"]);
    expect(queue.onDeck?.id).toBe("a");
    expect(queue.inHole?.id).toBe("b");
    expect(queue.total).toBe(4);
  });

  it("puts the called team on the maze and the next two on deck and in the hole", () => {
    const queue = buildQueue(field, "b");
    expect(queue.now?.id).toBe("b");
    expect(queue.onDeck?.id).toBe("c");
    expect(queue.inHole?.id).toBe("d");
  });

  it("comes back round for a team that was skipped", () => {
    // A was called but never ran; once D is on the maze, A is next.
    const queue = buildQueue(field, "d");
    expect(names(queue.upcoming)).toEqual(["a", "b", "c"]);
    const done = field.map((entry) => (entry.id === "a" || entry.id === "b" ? { ...entry, ran: true } : entry));
    expect(names(buildQueue(done, "d").upcoming)).toEqual(["c"]);
  });

  it("leaves out teams that have run, withdrew or failed inspection", () => {
    const entries = [team("a", 1, { ran: true }), team("b", 2, { eligible: false }), team("c", 3), team("d", 4)];
    const queue = buildQueue(entries, "");
    expect(names(queue.upcoming)).toEqual(["c", "d"]);
    expect(queue.ran).toBe(1);
  });

  it("keeps the team on the maze there after its sheet is saved, until the next call", () => {
    const entries = [team("a", 1, { ran: true }), team("b", 2)];
    expect(buildQueue(entries, "a").now?.id).toBe("a");
    expect(nextToCall(entries, "a")?.id).toBe("b");
  });

  it("has nobody to call once every team has run", () => {
    const entries = [team("a", 1, { ran: true }), team("b", 2, { ran: true })];
    expect(nextToCall(entries, "b")).toBeNull();
  });

  it("goes back to whoever was really on the maze before, even out of turn", () => {
    // A, then D out of turn, then B: back goes to D, then A, then nowhere.
    let history = pushHistory("", "");
    history = pushHistory(history, "a");
    history = pushHistory(history, "d");
    expect(history).toBe("a,d");
    const first = popHistory(history);
    expect(first).toEqual({ id: "d", history: "a" });
    expect(popHistory(first!.history)).toEqual({ id: "a", history: "" });
    expect(popHistory("")).toBeNull();
  });

  it("keeps only the last few calls", () => {
    let history = "";
    for (let i = 0; i < HISTORY_MAX + 5; i++) history = pushHistory(history, `t${i}`);
    expect(history.split(",")).toHaveLength(HISTORY_MAX);
    expect(popHistory(history)?.id).toBe(`t${HISTORY_MAX + 4}`);
  });

  it("tells a team where it stands", () => {
    const entries = [...field, team("e", 5), team("f", 6, { ran: true })];
    const queue = buildQueue(entries, "b");
    expect(placeOf(queue, entries, "b")).toEqual({ kind: "now" });
    expect(placeOf(queue, entries, "c")).toEqual({ kind: "on-deck" });
    expect(placeOf(queue, entries, "d")).toEqual({ kind: "in-hole" });
    expect(placeOf(queue, entries, "e")).toEqual({ kind: "waiting", ahead: 2 });
    expect(placeOf(queue, entries, "a")).toEqual({ kind: "waiting", ahead: 3 });
    expect(placeOf(queue, entries, "f")).toEqual({ kind: "ran" });
    expect(placeOf(queue, entries, "x")).toBeNull();
  });
});

describe("when a team will be called", () => {
  const called = new Date("2026-11-14T08:00:00Z");

  it("counts one slot per team ahead from the last call", () => {
    const now = new Date("2026-11-14T08:03:00Z");
    expect(estimateCall(called, now, 10, 0).toISOString()).toBe("2026-11-14T08:10:00.000Z");
    expect(estimateCall(called, now, 10, 2).toISOString()).toBe("2026-11-14T08:30:00.000Z");
  });

  it("never gives a time already gone when the team on the maze runs over", () => {
    const now = new Date("2026-11-14T08:25:00Z");
    expect(estimateCall(called, now, 10, 0).toISOString()).toBe(now.toISOString());
  });

  it("counts from now when nobody has been called", () => {
    const now = new Date("2026-11-14T08:00:00Z");
    expect(estimateCall(null, now, 8, 1).toISOString()).toBe("2026-11-14T08:16:00.000Z");
  });
});
