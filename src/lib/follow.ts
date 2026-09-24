import { ordinal, phaseInfo } from "@/lib/bracket";
import type { CompetitionState } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import type { QueueView } from "@/lib/day-queue";
import { formatPoints } from "@/lib/score-sheet";

/**
 * What the "your team" card says about a team someone follows: where it
 * stands and what comes next for it. Worked out from the public competition,
 * so it never says more than the pages do.
 */
export interface FollowCard {
  id: string;
  name: string;
  /** Where it stands: "In the Round of 16", "Provisionally 4th". */
  status: string;
  /** What is next: "On deck · about 10:40", "Round of 16 v Byte Mice · 14:20 · Maze A". */
  next: string;
  tone: "live" | "gold" | "good" | "ink" | "muted";
  live: boolean;
}

export function followCards(state: CompetitionState, queue: Pick<QueueView, "active" | "placeOf" | "etaOf">): FollowCard[] {
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  return state.competitors.map((team) => {
    const journey = team.journey;
    const base = { id: team.id, name: team.name, status: journey.label };

    if (journey.state === "CHAMPION") return { ...base, next: "Champions of MMRC 26", tone: "gold", live: false };
    if (journey.state === "RUNNER_UP" || journey.state === "ELIMINATED" || journey.state === "NOT_QUALIFIED") {
      return { ...base, next: "Thank you for racing", tone: "muted", live: false };
    }

    if (journey.state === "ALIVE") {
      const match = state.bracket
        .filter((m) => (m.teamAId === team.id || m.teamBId === team.id) && !m.winnerId && !m.void)
        .sort((a, b) => a.round - b.round)[0];
      if (match) {
        const opponent = nameOf(match.teamAId === team.id ? match.teamBId : match.teamAId);
        const live = match.status === "LIVE";
        const parts = [
          live ? `On the maze now${opponent ? ` v ${opponent}` : ""}` : `${phaseInfo(match.round).name}${opponent ? ` v ${opponent}` : ", opponent to come"}`,
          !live && match.scheduledAt ? clockTime(match.scheduledAt) : "",
          match.arena,
        ].filter(Boolean);
        return { ...base, next: parts.join(" · "), tone: live ? "live" : "good", live };
      }
      return { ...base, next: "Waiting for the next round", tone: "good", live: false };
    }

    // Qualifying.
    const place = queue.active ? queue.placeOf(team.id) : null;
    const eta = queue.etaOf(team.id);
    if (place?.kind === "now") return { ...base, status: "Qualifying", next: "On the maze now", tone: "live", live: true };
    if (place?.kind === "on-deck") return { ...base, status: "Qualifying", next: `On deck${eta ? ` · ${eta}` : ""}. Next on the maze`, tone: "gold", live: false };
    if (place?.kind === "in-hole") return { ...base, status: "Qualifying", next: `In the hole${eta ? ` · ${eta}` : ""}. Two to go`, tone: "gold", live: false };
    if (place?.kind === "waiting") {
      return { ...base, status: "Qualifying", next: `${place.ahead} teams before it${eta ? ` · ${eta}` : ""}`, tone: "ink", live: false };
    }
    const standing = team.standing;
    if (standing?.recorded) {
      return {
        ...base,
        next: standing.rank ? `${ordinal(standing.rank)} with ${formatPoints(standing.best)} points` : "Has run. Results are announced soon",
        tone: standing.qualified ? "good" : "ink",
        live: false,
      };
    }
    return { ...base, next: team.eligible ? "Yet to run" : "Not eligible to qualify", tone: "ink", live: false };
  });
}
