import { FINAL_ROUND, KNOCKOUT_ROUNDS, THIRD_PLACE_ROUND } from "@/lib/bracket";
import { addMinutes } from "@/lib/time-shift";

/**
 * Timing the knockout: every match a time and a maze, round after round.
 *
 * Each match is played on one maze, and the mazes run side by side: with two
 * mazes, two matches at a time, the first on the first maze and the second on
 * the second. The third place play-off and the final are played on their own,
 * on the first maze, with the hall watching.
 *
 * The plan is a starting point: the Mazes and times desk saves it, and any
 * match's time or maze can then be changed by hand.
 *
 * Free of Prisma and of Next so it can be tested on its own.
 */

/** The order the rounds are played in: the play-off comes before the final. */
export const PLAY_ORDER: readonly number[] = [...KNOCKOUT_ROUNDS.filter((round) => round !== FINAL_ROUND), THIRD_PLACE_ROUND, FINAL_ROUND];

/** Rounds played one match at a time, whatever the mazes. */
export const ALONE_ROUNDS: readonly number[] = [THIRD_PLACE_ROUND, FINAL_ROUND];

export interface SchedulableMatch {
  id: string;
  round: number;
  slot: number;
  /** A bye or a walkover: there is nothing to play. */
  void: boolean;
  /** A result is in: it keeps the time it had. */
  done: boolean;
}

export interface ScheduleSettings {
  /** When the first match starts, "13:00". */
  start: string;
  /** How long one match takes, slot to slot. */
  minutes: number;
  /** The gap between one round's last matches and the next round. */
  breakMinutes: number;
  /** The round to start from: earlier rounds are left as they are. */
  fromRound: number;
  mazes: readonly string[];
}

export interface PlannedMatch {
  id: string;
  round: number;
  time: string;
  maze: string;
}

/** How many matches of a round are played at once. */
export function matchesAtOnce(round: number, mazes: number): number {
  return ALONE_ROUNDS.includes(round) ? 1 : Math.max(1, mazes);
}

/**
 * Every match still to play, from `fromRound` on, with its time and maze.
 * Null when the start is not a time.
 */
export function planKnockoutSchedule(matches: readonly SchedulableMatch[], settings: ScheduleSettings): PlannedMatch[] | null {
  const from = PLAY_ORDER.indexOf(settings.fromRound);
  const rounds = PLAY_ORDER.slice(from < 0 ? 0 : from);
  let clock: string | null = addMinutes(settings.start, 0);
  if (!clock) return null;

  const planned: PlannedMatch[] = [];
  for (const round of rounds) {
    const toPlay = matches.filter((match) => match.round === round && !match.void && !match.done).sort((a, b) => a.slot - b.slot);
    if (!toPlay.length) continue;
    const atOnce = matchesAtOnce(round, settings.mazes.length);
    toPlay.forEach((match, index) => {
      planned.push({
        id: match.id,
        round,
        time: addMinutes(clock!, Math.floor(index / atOnce) * settings.minutes)!,
        maze: settings.mazes[index % atOnce] ?? "",
      });
    });
    clock = addMinutes(clock, Math.ceil(toPlay.length / atOnce) * settings.minutes + settings.breakMinutes);
    if (!clock) return null;
  }
  return planned;
}
