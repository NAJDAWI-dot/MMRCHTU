import { describe, expect, it } from "vitest";
import { HISTORY_MAX, buildQueue, callOne, calledIds, estimateCall, groupKey, laneOf, nextToCall, placeOf, popHistory, pushHistory, type QueueEntry } from "@/lib/run-queue";

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
    expect(names(nextToCall(entries, "a"))).toEqual(["b"]);
  });

  it("has nobody to call once every team has run", () => {
    const entries = [team("a", 1, { ran: true }), team("b", 2, { ran: true })];
    expect(nextToCall(entries, "b")).toEqual([]);
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

describe("two mazes side by side", () => {
  const MAZES = ["Maze A", "Maze B"];
  // The draw shares the order round the mazes: odd places on A, even on B.
  const field = [1, 2, 3, 4, 5, 6].map((order) => team(`t${order}`, order, { maze: MAZES[(order - 1) % 2] }));

  it("puts a team in the lane of its maze, or shares the order round them when it has none", () => {
    expect(laneOf(team("a", 3, { maze: "maze b" }), MAZES)).toBe(1);
    expect(laneOf(team("a", 3), MAZES)).toBe(0);
    expect(laneOf(team("a", 4), MAZES)).toBe(1);
    expect(laneOf(team("a", 4, { maze: "Old table" }), MAZES)).toBe(1);
    expect(laneOf(team("a", 4, { maze: "Maze B" }), [])).toBe(0);
  });

  it("calls two at a time, one per maze, and lines up the next two calls", () => {
    const first = buildQueue(field, "", MAZES);
    expect(first.lanes).toBe(2);
    expect(names(first.deckGroup)).toEqual(["t1", "t2"]);
    expect(names(first.holeGroup)).toEqual(["t3", "t4"]);
    expect(groupKey(first.deckGroup)).toBe("t1+t2");

    const second = buildQueue(field, "t1+t2", MAZES);
    expect(names(second.nowGroup)).toEqual(["t1", "t2"]);
    expect(second.now?.id).toBe("t1");
    expect(names(second.deckGroup)).toEqual(["t3", "t4"]);
    expect(names(second.holeGroup)).toEqual(["t5", "t6"]);
    expect(names(second.upcoming)).toEqual(["t3", "t4", "t5", "t6"]);
  });

  it("says where a team stands in calls, not places", () => {
    const queue = buildQueue(field, "t1+t2", MAZES);
    expect(placeOf(queue, field, "t2")).toEqual({ kind: "now" });
    expect(placeOf(queue, field, "t4")).toEqual({ kind: "on-deck" });
    expect(placeOf(queue, field, "t6")).toEqual({ kind: "in-hole" });
    const later = [...field, team("t7", 7, { maze: "Maze A" }), team("t8", 8, { maze: "Maze B" })];
    expect(placeOf(buildQueue(later, "t1+t2", MAZES), later, "t8")).toEqual({ kind: "waiting", ahead: 2 });
  });

  it("brings a skipped team round again at the end of its own maze's lane", () => {
    // T3 was not at the table when called; the rest have run, and T5 and T6 are on.
    const done = field.map((entry) => (["t1", "t2", "t4"].includes(entry.id) ? { ...entry, ran: true } : entry));
    const after = buildQueue(done, "t5+t6", MAZES);
    expect(names(after.deckGroup)).toEqual(["t3"]);
    expect(after.holeGroup).toEqual([]);
  });

  it("calls just one team when the other maze has nobody left", () => {
    const odd = field.slice(0, 5).map((entry) => (entry.runOrder! <= 4 ? { ...entry, ran: true } : entry));
    expect(names(nextToCall(odd, "t3+t4", MAZES))).toEqual(["t5"]);
  });

  it("puts a team called out of turn on its own maze and keeps the other maze's team", () => {
    expect(callOne(field, "t1+t2", MAZES, "t5")).toBe("t2+t5");
    expect(callOne(field, "t1+t2", MAZES, "t6")).toBe("t1+t6");
    expect(callOne(field, "", MAZES, "t4")).toBe("t4");
    expect(calledIds("t2+t5")).toEqual(["t2", "t5"]);
  });

  it("goes back a whole call at a time", () => {
    const history = pushHistory(pushHistory("", "t1+t2"), "t3+t4");
    expect(popHistory(history)).toEqual({ id: "t3+t4", history: "t1+t2" });
  });

  it("still reads a queue saved before there were lanes", () => {
    const queue = buildQueue(field, "t3", MAZES);
    expect(names(queue.nowGroup)).toEqual(["t3"]);
    // T3 is on Maze A; Maze B carries on from the same place in the order.
    expect(names(queue.deckGroup)).toEqual(["t5", "t4"]);
  });
});
