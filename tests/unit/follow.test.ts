import { describe, expect, it } from "vitest";
import type { CompetitionState } from "@/lib/competition";
import { followCards, readyNotices } from "@/lib/follow";
import type { QueuePlace } from "@/lib/run-queue";

const team = (id: string, name: string, journey: object, standing?: object, qualifyingMaze = "") => ({ id, name, eligible: true, journey, standing, qualifyingMaze });

function stateOf(competitors: ReturnType<typeof team>[], bracket: object[] = []) {
  return { competitors, bracket, byId: new Map(competitors.map((t) => [t.id, t])) } as unknown as CompetitionState;
}
const queueOf = (places: Record<string, QueuePlace>, eta: Record<string, string> = {}) => ({
  active: true,
  placeOf: (id: string) => places[id] ?? null,
  etaOf: (id: string) => eta[id] ?? "",
});

describe("the card for a team someone follows", () => {
  it("follows the call queue in qualifying", () => {
    const qualifying = { state: "QUALIFYING", label: "Qualifying", round: 1, seed: null };
    const state = stateOf([team("a", "Alpha", qualifying), team("b", "Beta", qualifying, undefined, "Maze B"), team("c", "Gamma", qualifying, undefined, "Maze A")]);
    const cards = followCards(state, queueOf({ a: { kind: "now" }, b: { kind: "on-deck" }, c: { kind: "waiting", ahead: 4 } }, { b: "about 10:40", c: "about 11:20" }));
    expect(cards.map((card) => [card.id, card.next, card.live])).toEqual([
      ["a", "On the maze now. Your eight minutes. Good luck.", true],
      ["b", "Get ready, you are next. Bring your robot to Maze B now. You run about 10:40.", false],
      ["c", "4 teams before it on Maze A · about 11:20", false],
    ]);
    expect(cards[1]!.notice?.tone).toBe("gold");
    expect(cards[2]!.notice).toBeUndefined();
  });

  it("gives the place once a team has run, or says results are coming when they are held back", () => {
    const qualifying = { state: "QUALIFYING", label: "Provisionally 4th", round: 1, seed: null };
    const state = stateOf([
      team("a", "Alpha", qualifying, { recorded: true, rank: 4, best: 78.43, qualified: true }),
      team("b", "Beta", { ...qualifying, label: "Results to come" }, { recorded: true, rank: null, best: null, qualified: false }),
    ]);
    const cards = followCards(state, queueOf({ a: { kind: "ran" }, b: { kind: "ran" } }));
    expect(cards[0]!.next).toBe("4th with 78.4 points");
    expect(cards[1]!.next).toBe("Has run. Results are announced soon");
    expect(cards[1]!.status).toBe("Results to come");
  });

  it("names the next match in the knockout, its time and maze", () => {
    const alive = { state: "ALIVE", label: "In the Round of 16", round: 3, seed: 4 };
    const state = stateOf(
      [team("a", "Alpha", alive), team("b", "Beta", alive)],
      [{ id: "m1", round: 3, slot: 0, teamAId: "a", teamBId: "b", winnerId: null, void: false, status: "PENDING", arena: "", mazeA: "Maze A", mazeB: "Maze B", scheduledAt: new Date("2026-03-14T11:20:00Z") }],
    );
    const [alpha, beta] = followCards(state, queueOf({}));
    // The only match left to play is next, so both teams are told to get ready, each to its own maze.
    expect(alpha!.next).toBe("Get ready, your match is next. Round of 16 v Beta at 14:20. Bring your robot to Maze A now.");
    expect(beta!.next).toBe("Get ready, your match is next. Round of 16 v Alpha at 14:20. Bring your robot to Maze B now.");
    expect(alpha!.tone).toBe("gold");
  });

  it("tells only the next two matches to get ready, and a match on the maze that it is on", () => {
    const alive = { state: "ALIVE", label: "In the Round of 16", round: 3, seed: null };
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const match = (slot: number, status = "PENDING") => ({
      id: `m${slot}`,
      round: 3,
      slot,
      teamAId: ids[slot * 2],
      teamBId: ids[slot * 2 + 1],
      winnerId: null,
      void: false,
      walkover: false,
      status,
      arena: "",
      mazeA: "Maze A",
      mazeB: "Maze B",
      scheduledAt: null,
    });
    const state = stateOf(
      ids.map((id) => team(id, id.toUpperCase(), alive)),
      [match(0, "LIVE"), match(1), match(2), match(3)],
    );
    const notices = readyNotices(state, queueOf({}));
    expect(notices.get("a")?.title).toBe("On the maze now");
    expect(notices.get("a")?.body).toBe("Round of 16 v B · Maze A. Good luck.");
    expect(notices.get("c")?.title).toBe("Get ready, your match is next");
    expect(notices.get("f")?.title).toBe("Get ready, your match is next");
    expect(notices.has("g")).toBe(false);
    // Further back, the card still says what is next and where.
    expect(followCards(state, queueOf({})).find((card) => card.id === "g")!.next).toBe("Round of 16 v H · Maze A");
  });

  it("says third place, and thanks a fourth-placed team", () => {
    const cards = followCards(
      stateOf([team("a", "Alpha", { state: "THIRD", label: "Third place", round: 7, seed: 3 }), team("b", "Beta", { state: "FOURTH", label: "Fourth place", round: 7, seed: 2 })]),
      queueOf({}),
    );
    expect(cards[0]!.next).toBe("Third place at MMRC 26");
    expect(cards[1]!.next).toBe("Thank you for racing");
  });

  it("crowns the champions", () => {
    const card = followCards(stateOf([team("a", "Alpha", { state: "CHAMPION", label: "Champions", round: 6, seed: 1 })]), queueOf({}))[0]!;
    expect(card.next).toBe("Champions of MMRC 26");
    expect(card.tone).toBe("gold");
  });
});
