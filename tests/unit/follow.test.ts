import { describe, expect, it } from "vitest";
import type { CompetitionState } from "@/lib/competition";
import { followCards } from "@/lib/follow";
import type { QueuePlace } from "@/lib/run-queue";

const team = (id: string, name: string, journey: object, standing?: object) => ({ id, name, eligible: true, journey, standing });

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
    const state = stateOf([team("a", "Alpha", qualifying), team("b", "Beta", qualifying), team("c", "Gamma", qualifying)]);
    const cards = followCards(state, queueOf({ a: { kind: "now" }, b: { kind: "on-deck" }, c: { kind: "waiting", ahead: 4 } }, { b: "about 10:40", c: "about 11:20" }));
    expect(cards.map((card) => [card.id, card.next, card.live])).toEqual([
      ["a", "On the maze now", true],
      ["b", "On deck · about 10:40. Next on the maze", false],
      ["c", "4 teams before it · about 11:20", false],
    ]);
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
      [{ round: 3, slot: 0, teamAId: "a", teamBId: "b", winnerId: null, void: false, status: "PENDING", arena: "Maze A", scheduledAt: new Date("2026-03-14T11:20:00Z") }],
    );
    const card = followCards(state, queueOf({}))[0]!;
    expect(card.next).toBe("Round of 16 v Beta · 14:20 · Maze A");
    expect(card.tone).toBe("good");
  });

  it("crowns the champions", () => {
    const card = followCards(stateOf([team("a", "Alpha", { state: "CHAMPION", label: "Champions", round: 6, seed: 1 })]), queueOf({}))[0]!;
    expect(card.next).toBe("Champions of MMRC 26");
    expect(card.tone).toBe("gold");
  });
});
