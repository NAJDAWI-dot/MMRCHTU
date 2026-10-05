import { FINAL_ROUND, KNOCKOUT_ROUNDS, THIRD_PLACE_ROUND } from "@/lib/bracket";
import { addMinutes } from "@/lib/time-shift";

/**
 * Timing the knockout: every match a time, and each of its teams a maze.
 *
 * A knockout match is head to head: its two teams run at the same time, the
 * top team on the first maze and the bottom team on the second, and the
 * matches follow one another. With one maze, both teams share it.
 *
 * The plan is a starting point: the Mazes and times desk saves it, and any
 * match's time or mazes can then be changed by hand.
 *
 * Free of Prisma and of Next so it can be tested on its own.
 */

/** The order the rounds are played in: the play-off comes before the final. */
export const PLAY_ORDER: readonly number[] = [...KNOCKOUT_ROUNDS.filter((round) => round !== FINAL_ROUND), THIRD_PLACE_ROUND, FINAL_ROUND];

/** Rounds of one match, listed without a match number. */
export const THIRD_OR_FINAL: readonly number[] = [THIRD_PLACE_ROUND, FINAL_ROUND];

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
  /** How long one match takes, start to start. */
  minutes: number;
  /** The gap between one round's last match and the next round. */
  breakMinutes: number;
  /** The round to start from: earlier rounds are left as they are. */
  fromRound: number;
  mazes: readonly string[];
}

export interface PlannedMatch {
  id: string;
  round: number;
  time: string;
  /** The top team's maze and the bottom team's. */
  mazeA: string;
  mazeB: string;
}

/** The two sides' mazes in a head-to-head match: one each, or the one maze there is. */
export function headToHead(mazes: readonly string[]): { mazeA: string; mazeB: string } {
  return { mazeA: mazes[0] ?? "", mazeB: mazes[1] ?? mazes[0] ?? "" };
}

/**
 * Every match still to play, from `fromRound` on, with its time and both
 * teams' mazes. Null when the start is not a time.
 */
export function planKnockoutSchedule(matches: readonly SchedulableMatch[], settings: ScheduleSettings): PlannedMatch[] | null {
  const from = PLAY_ORDER.indexOf(settings.fromRound);
  const rounds = PLAY_ORDER.slice(from < 0 ? 0 : from);
  let clock: string | null = addMinutes(settings.start, 0);
  if (!clock) return null;
  const sides = headToHead(settings.mazes);

  const planned: PlannedMatch[] = [];
  for (const round of rounds) {
    const toPlay = matches.filter((match) => match.round === round && !match.void && !match.done).sort((a, b) => a.slot - b.slot);
    if (!toPlay.length) continue;
    toPlay.forEach((match, index) => {
      planned.push({ id: match.id, round, time: addMinutes(clock!, index * settings.minutes)!, ...sides });
    });
    clock = addMinutes(clock, toPlay.length * settings.minutes + settings.breakMinutes);
    if (!clock) return null;
  }
  return planned;
}
