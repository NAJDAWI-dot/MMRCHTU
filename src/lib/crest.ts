import { generateMaze, seededRandom, type Maze } from "@/lib/maze";

/**
 * A team's crest: a maze derived from its name.
 *
 * The competition's own generator, seeded by the team name, so every team gets
 * a small maze that is theirs and only theirs — and gets it while they are
 * still typing the name, before they have built anything or paid anything.
 * The same name always produces the same crest, which is what lets it appear
 * again later on a confirmation, an email or a results card and still be
 * recognised.
 *
 * Free of React and of the DOM, so the part that has to be stable — the hash —
 * is tested directly rather than by typing into a form.
 */

/** Even and at least 4, per generateMaze. Six reads as a maze at 72px; eight is mush. */
export const CREST_GRID = 6;

/**
 * A little braiding, so the crest has loops.
 *
 * A perfect carve at this size is mostly long straight corridors, and two
 * different names then produce two pictures that look alike. Loops are what
 * make them distinguishable at a glance.
 */
export const CREST_BRAID = 0.25;

/** One character is not a name, and hashing it produces a crest of nothing. */
export const MIN_CREST_NAME = 2;

/**
 * The form of the name the hash sees.
 *
 * Case and stray spaces are not identity: "Maze Runners", "maze runners" and
 * " Maze  Runners " are one team, and giving them three different crests would
 * make the crest feel random rather than earned.
 */
export function normaliseCrestName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * FNV-1a over the normalised name.
 *
 * Chosen for being short, dependency-free and well spread over tiny inputs —
 * team names are two or three words, which is exactly where a naive
 * sum-of-characters hash collides. Not a security function and not used as
 * one: the seed is public and predictable by design.
 */
export function crestSeed(name: string): number {
  let hash = 0x811c9dc5;
  for (const char of normaliseCrestName(name)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hasCrest(name: string): boolean {
  return normaliseCrestName(name).length >= MIN_CREST_NAME;
}

/**
 * The crest for a name, or null while there is not enough name to make one.
 *
 * Null rather than a fallback maze: an empty field should show a waiting
 * placeholder, not somebody else's crest.
 */
export function crestFor(name: string): Maze | null {
  if (!hasCrest(name)) return null;
  return generateMaze(CREST_GRID, seededRandom(crestSeed(name)), CREST_BRAID);
}
