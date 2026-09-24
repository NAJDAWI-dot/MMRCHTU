import { MATCH_SECONDS, MAZE_CELLS, type RunEntry } from "@/lib/score-sheet";

/**
 * Random qualifying sheets, for trying the day out before it happens.
 *
 * Every sheet it writes is signed TEST_DATA_BY, which no admin can be called,
 * so removing the test data removes exactly those and nothing a judge wrote.
 * Pure apart from the random numbers, which the tests pass in.
 */

export const TEST_DATA_BY = "test-data";
export const TEST_DATA_NOTE = "Random test data";

type Random = () => number;

const between = (random: Random, low: number, high: number) => low + random() * (high - low);

/**
 * One team's eight minutes, made up but believable: a team has a skill that
 * decides how often it reaches the centre and how far it gets when it does
 * not, and a pace. The first run is a slow search; later ones are faster. About
 * one team in eight never reaches the centre at all. The runs always fit in
 * the match.
 */
export function randomSheet(random: Random = Math.random): RunEntry[] {
  const hopeless = random() < 0.12;
  const skill = hopeless ? 0 : between(random, 0.25, 0.95);
  const pace = between(random, 16, 60);
  const attempts = 1 + Math.floor(random() * 6);

  const log: RunEntry[] = [];
  let used = 0;
  for (let index = 0; index < attempts; index++) {
    const reached = random() < skill;
    if (reached) {
      // A search run first, then speed runs a little either side of the pace.
      const time = Math.round((index === 0 ? pace * between(random, 1.6, 2.4) : pace * between(random, 0.85, 1.25)) * 100) / 100;
      if (used + time > MATCH_SECONDS) break;
      used += time;
      log.push({ ok: true, time, cell: null });
    } else {
      // A better mouse gets further before it goes wrong.
      const cell = Math.max(1, Math.min(MAZE_CELLS - 1, Math.round(between(random, 5, 60) + skill * 40)));
      log.push({ ok: false, time: null, cell });
    }
  }
  return log.length ? log : [{ ok: false, time: null, cell: 1 + Math.floor(random() * (MAZE_CELLS - 1)) }];
}
