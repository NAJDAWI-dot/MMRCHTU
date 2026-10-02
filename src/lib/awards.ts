import { FINAL_ROUND, PLAYED_ROUNDS, THIRD_PLACE_ROUND, phaseInfo } from "@/lib/bracket";
import { formatPoints } from "@/lib/score-sheet";

/**
 * The awards, as the rulebook lists them (version 3, "Awards").
 *
 * Three come from the bracket: 1st (the final's winner), 2nd (its loser) and
 * 3rd (the third place play-off's winner). One comes from the scores: the
 * highest single score in any knockout match. Four are the judges' call: Best
 * Code and Best Creative Design and a runner-up for each, picked on the Awards
 * desk and stored as team ids.
 *
 * Free of Prisma and of Next so it can be tested on its own.
 */

export const JUDGED_AWARDS = [
  {
    key: "awardBestCode",
    title: "Best Code",
    blurb: "The best logic, algorithmic efficiency or mapping technique, judged during the source code review.",
  },
  { key: "awardBestCodeRunnerUp", title: "Best Code runner-up", blurb: "The second best code." },
  {
    key: "awardBestDesign",
    title: "Best Creative Design",
    blurb: "The best physical build: hardware solutions, custom PCB work or chassis design.",
  },
  { key: "awardBestDesignRunnerUp", title: "Best Creative Design runner-up", blurb: "The second best physical build." },
] as const;

export type JudgedAwardKey = (typeof JUDGED_AWARDS)[number]["key"];
export type JudgedPicks = Record<JudgedAwardKey, string>;

export interface AwardMatch {
  round: number;
  slot: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  walkover: boolean;
  void: boolean;
}

export interface Award {
  key: string;
  title: string;
  blurb: string;
  kind: "place" | "score" | "judged";
  /** 1, 2 or 3 for the placings. */
  place?: 1 | 2 | 3;
  /** The winner, or null while it is still to be decided or held back. */
  teamId: string | null;
  /** "142.9 points in the Semi-finals", for the highest score. */
  detail: string;
}

const loserOf = (match: AwardMatch) => (match.winnerId === match.teamAId ? match.teamBId : match.teamAId);

/** 1st to 4th, as far as the bracket has got. A play-off nobody played leaves 3rd and 4th empty. */
export function placings(matches: readonly AwardMatch[]): { first: string | null; second: string | null; third: string | null; fourth: string | null } {
  const final = matches.find((match) => match.round === FINAL_ROUND && match.slot === 0);
  const playoff = matches.find((match) => match.round === THIRD_PLACE_ROUND && match.slot === 0);
  const decided = (match: AwardMatch | undefined) => !!match?.winnerId && !match.void;
  return {
    first: decided(final) ? final!.winnerId : null,
    second: decided(final) ? loserOf(final!) : null,
    third: decided(playoff) ? playoff!.winnerId : null,
    fourth: decided(playoff) && !playoff!.walkover ? loserOf(playoff!) : null,
  };
}

/**
 * The best single score in any knockout match, the play-off included. On a
 * tie, the one scored first (the earlier round, then the earlier match).
 */
export function highestScore(matches: readonly AwardMatch[]): { teamId: string; score: number; round: number } | null {
  let best: { teamId: string; score: number; round: number } | null = null;
  const order = (round: number) => PLAYED_ROUNDS.indexOf(round as (typeof PLAYED_ROUNDS)[number]);
  const sorted = [...matches].filter((match) => order(match.round) !== -1).sort((a, b) => order(a.round) - order(b.round) || a.slot - b.slot);
  for (const match of sorted) {
    if (match.walkover || match.void) continue;
    for (const [teamId, score] of [
      [match.teamAId, match.scoreA],
      [match.teamBId, match.scoreB],
    ] as const) {
      if (!teamId || score === null || !Number.isFinite(score)) continue;
      if (!best || score > best.score) best = { teamId, score, round: match.round };
    }
  }
  return best;
}

/** A judged pick as stored: a team still in the competition, or nothing. */
export function judgedPick(value: unknown, known: (id: string) => boolean): string {
  const id = String(value ?? "").trim();
  return id && known(id) ? id : "";
}

/**
 * Every award in the rulebook's order. With `showAll` off (the public before
 * the awards are revealed) the highest score and the judges' picks are held
 * back: they are announced at the prize-giving, not as they happen.
 */
export function awardsList(matches: readonly AwardMatch[], picks: Partial<JudgedPicks>, showAll: boolean): Award[] {
  const podium = placings(matches);
  const top = highestScore(matches);
  return [
    { key: "first", title: "MMRC26 Champion", blurb: "Winner of the Grand Final.", kind: "place", place: 1, teamId: podium.first, detail: "" },
    { key: "second", title: "2nd place", blurb: "Runner-up in the Grand Final.", kind: "place", place: 2, teamId: podium.second, detail: "" },
    { key: "third", title: "3rd place", blurb: "Winner of the third place play-off.", kind: "place", place: 3, teamId: podium.third, detail: "" },
    {
      key: "highest",
      title: "Overall Highest Score",
      blurb: "The best single score in any knockout match.",
      kind: "score",
      teamId: showAll ? (top?.teamId ?? null) : null,
      detail: showAll && top ? `${formatPoints(top.score)} points in the ${phaseInfo(top.round).name}` : "",
    },
    ...JUDGED_AWARDS.map(
      (award): Award => ({
        key: award.key,
        title: award.title,
        blurb: award.blurb,
        kind: "judged",
        teamId: showAll ? picks[award.key] || null : null,
        detail: "",
      }),
    ),
  ];
}

/** The judges' picks as stored on the config row, each checked against the teams still in the competition. */
export function picksOf(config: Record<JudgedAwardKey, string>, known: (id: string) => boolean): JudgedPicks {
  return Object.fromEntries(JUDGED_AWARDS.map((award) => [award.key, judgedPick(config[award.key], known)])) as JudgedPicks;
}
