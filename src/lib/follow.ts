import { THIRD_PLACE_ROUND, ordinal, phaseInfo } from "@/lib/bracket";
import type { BracketMatch, CompetitionState } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import type { QueueView } from "@/lib/day-queue";
import { sideMaze } from "@/lib/mazes";
import { formatPoints } from "@/lib/score-sheet";

/**
 * "Get ready": what a team has to do right now, when it has to do something.
 *
 * In qualifying, the team on the maze, on deck and in the hole. In the
 * knockout, a team whose match is on the maze, or among the next two to be
 * played. Each says where to go: the maze the Mazes desk put the team on.
 * `key` changes whenever the message does, so a phone can buzz once per call.
 */
export interface ReadyNotice {
  key: string;
  tone: "live" | "gold";
  title: string;
  body: string;
}

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
  /** Set when the team is being called: the card pops a banner and buzzes. */
  notice?: ReadyNotice;
}

/** How many knockout matches ahead count as "next": the two after the ones on the maze. */
const UP_NEXT = 2;

/** The play-off is usually run before the final, so it sorts between the semi-finals and the final. */
const playOrder = (round: number) => (round === THIRD_PLACE_ROUND ? 5.5 : round);

const playable = (match: BracketMatch) => !!match.teamAId && !!match.teamBId && !match.walkover && !match.void;

/** Every team that has to get ready, by id. */
export function readyNotices(state: CompetitionState, queue: Pick<QueueView, "active" | "placeOf" | "etaOf">): Map<string, ReadyNotice> {
  const out = new Map<string, ReadyNotice>();
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");

  // The knockout, once there is one.
  const open = state.bracket.filter((match) => playable(match) && !match.winnerId);
  const waiting = open
    .filter((match) => match.status !== "LIVE")
    .sort(
      (a, b) =>
        (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity) || playOrder(a.round) - playOrder(b.round) || a.slot - b.slot,
    )
    .slice(0, UP_NEXT);
  for (const match of [...open.filter((m) => m.status === "LIVE"), ...waiting]) {
    const live = match.status === "LIVE";
    for (const [teamId, opponentId] of [
      [match.teamAId!, match.teamBId!],
      [match.teamBId!, match.teamAId!],
    ] as const) {
      const maze = sideMaze(match, teamId);
      const what = `${phaseInfo(match.round).name} v ${nameOf(opponentId)}`;
      const time = !live && match.scheduledAt ? ` at ${clockTime(match.scheduledAt)}` : "";
      out.set(
        teamId,
        live
          ? { key: `${match.id}:live`, tone: "live", title: "On the maze now", body: `${what}${maze ? ` · ${maze}` : ""}. Good luck.` }
          : {
              key: `${match.id}:next:${maze}`,
              tone: "gold",
              title: "Get ready, your match is next",
              body: `${what}${time}. Bring your robot to ${maze || "the mazes"} now.`,
            },
      );
    }
  }

  // Qualifying, while the call queue is running.
  if (queue.active) {
    for (const team of state.competitors) {
      const place = queue.placeOf(team.id);
      if (!place) continue;
      const maze = team.qualifyingMaze;
      const eta = queue.etaOf(team.id);
      if (place.kind === "now") {
        out.set(team.id, { key: `q:now:${maze}`, tone: "live", title: "On the maze now", body: `Your eight minutes${maze ? ` on ${maze}` : ""}. Good luck.` });
      } else if (place.kind === "on-deck") {
        out.set(team.id, {
          key: `q:deck:${maze}`,
          tone: "gold",
          title: "Get ready, you are next",
          body: `Bring your robot to ${maze || "the maze"} now${eta ? `. You run ${eta}` : ""}.`,
        });
      } else if (place.kind === "in-hole") {
        out.set(team.id, {
          key: `q:hole:${maze}`,
          tone: "gold",
          title: "Get ready, two teams before you",
          body: `Head to the staging table with your robot${maze ? `. You run on ${maze}` : ""}${eta ? `, ${eta}` : ""}.`,
        });
      }
    }
  }
  return out;
}

export function followCards(state: CompetitionState, queue: Pick<QueueView, "active" | "placeOf" | "etaOf">): FollowCard[] {
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const notices = readyNotices(state, queue);
  return state.competitors.map((team) => {
    const journey = team.journey;
    const base = { id: team.id, name: team.name, status: journey.label };

    const notice = notices.get(team.id);
    if (notice) {
      return { ...base, status: journey.state === "ALIVE" ? journey.label : "Qualifying", next: `${notice.title}. ${notice.body}`, tone: notice.tone, live: notice.tone === "live", notice };
    }

    if (journey.state === "CHAMPION") return { ...base, next: "Champions of MMRC 26", tone: "gold", live: false };
    if (journey.state === "THIRD") return { ...base, next: "Third place at MMRC 26", tone: "gold", live: false };
    if (journey.state === "RUNNER_UP" || journey.state === "FOURTH" || journey.state === "ELIMINATED" || journey.state === "NOT_QUALIFIED") {
      return { ...base, next: "Thank you for racing", tone: "muted", live: false };
    }

    if (journey.state === "ALIVE") {
      const match = state.bracket
        .filter((m) => (m.teamAId === team.id || m.teamBId === team.id) && !m.winnerId && !m.void)
        .sort((a, b) => a.round - b.round)[0];
      if (match) {
        const opponent = nameOf(match.teamAId === team.id ? match.teamBId : match.teamAId);
        const parts = [
          `${phaseInfo(match.round).name}${opponent ? ` v ${opponent}` : ", opponent to come"}`,
          match.scheduledAt ? clockTime(match.scheduledAt) : "",
          sideMaze(match, team.id) || match.arena,
        ].filter(Boolean);
        return { ...base, next: parts.join(" · "), tone: "good", live: false };
      }
      return { ...base, next: "Waiting for the next round", tone: "good", live: false };
    }

    // Qualifying.
    const place = queue.active ? queue.placeOf(team.id) : null;
    const eta = queue.etaOf(team.id);
    if (place?.kind === "waiting") {
      return {
        ...base,
        status: "Qualifying",
        next: `${place.ahead} team${place.ahead === 1 ? "" : "s"} before it${team.qualifyingMaze ? ` on ${team.qualifyingMaze}` : ""}${eta ? ` · ${eta}` : ""}`,
        tone: "ink",
        live: false,
      };
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
    return { ...base, next: team.eligible ? `Yet to run${team.qualifyingMaze ? ` · ${team.qualifyingMaze}` : ""}` : "Not eligible to qualify", tone: "ink", live: false };
  });
}
