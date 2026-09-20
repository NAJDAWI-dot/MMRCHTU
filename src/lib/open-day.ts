import { CELL, MAZE_GOLD, generateMaze, type Maze, type Rand } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES, compareRuns } from "@/lib/rules";

/**
 * The open day page: how long the silent explainer runs for, and the
 * arithmetic behind the wall of crests.
 *
 * Free of React and of the DOM, like the rest of `lib`. The explainer is an
 * animation nobody can pause mid-frame to inspect, so the part that decides
 * what it should be showing at a given moment is settled here and tested
 * directly, rather than by watching a maze on a phone with a stopwatch.
 */

/**
 * The four beats of the explainer, in order.
 *
 * It plays at a stand, to somebody holding a phone in a loud hall, so it
 * carries its argument in captions and in the drawing and never in sound. The
 * beats exist because the point is a comparison: the first run is slow because
 * the mouse has never seen the maze, the second is fast because now it has.
 * Showing only the fast run would make micromouse look like line following.
 */
export const EXPLAINER_PHASES = ["search", "learned", "speed", "pitch"] as const;

export type ExplainerPhase = (typeof EXPLAINER_PHASES)[number];

export interface ExplainerBeat {
  phase: ExplainerPhase;
  ms: number;
}

/**
 * Twenty seconds, which is about as long as a passer-by will stand still.
 *
 * The search gets half of it because the wandering is the part that has to
 * look expensive, and the speed run is deliberately short: its whole job is to
 * feel abrupt next to the ten seconds that came before it.
 */
export const EXPLAINER_TIMELINE: readonly ExplainerBeat[] = [
  { phase: "search", ms: 10_000 },
  { phase: "learned", ms: 2_000 },
  { phase: "speed", ms: 4_500 },
  { phase: "pitch", ms: 3_500 },
] as const;

export const EXPLAINER_LENGTH_MS = EXPLAINER_TIMELINE.reduce((total, beat) => total + beat.ms, 0);

export interface ExplainerFrame {
  phase: ExplainerPhase;
  /** How far through this beat, from 0 to 1. */
  progress: number;
  /** How far through the whole run, from 0 to 1. Drives the progress bar. */
  overall: number;
}

/**
 * What the explainer should be showing `elapsedMs` into its run.
 *
 * Wraps, because the thing loops all day at a stand and nobody is there to
 * restart it. Negative input wraps too rather than throwing: a clock that has
 * gone backwards is a browser tab waking up, not a bug worth crashing over.
 */
export function explainerFrameAt(elapsedMs: number): ExplainerFrame {
  const total = EXPLAINER_LENGTH_MS;
  const t = ((elapsedMs % total) + total) % total;

  let spent = 0;
  for (const beat of EXPLAINER_TIMELINE) {
    if (t < spent + beat.ms) {
      return { phase: beat.phase, progress: (t - spent) / beat.ms, overall: t / total };
    }
    spent += beat.ms;
  }

  // Only reachable through floating-point drift at the very end of the last
  // beat, where the honest answer is "finished".
  const last = EXPLAINER_TIMELINE[EXPLAINER_TIMELINE.length - 1]!;
  return { phase: last.phase, progress: 1, overall: 1 };
}

/** Whether the mouse is drawing its exploring line or its fast one. */
export function explainerShowsSpeedRun(phase: ExplainerPhase): boolean {
  return phase === "speed" || phase === "pitch";
}

/**
 * How many crests the wall draws before it stops.
 *
 * Every crest is a generated maze, so a wall of them is a few hundred SVG
 * paths. On the day this page is opened on whatever phone is in someone's
 * pocket, and a cap costs nothing next to a page that scrolls badly.
 */
export const WALL_LIMIT = 120;

export interface WallSummary {
  total: number;
  shown: number;
  /** Teams past the cap, named in a line under the wall rather than dropped. */
  overflow: number;
}

export function wallSummary(total: number, limit = WALL_LIMIT): WallSummary {
  const shown = Math.max(0, Math.min(total, limit));
  return { total: Math.max(0, total), shown, overflow: Math.max(0, total - shown) };
}

/** "1 team" reads as broken when the number is one, so it is written out. */
export function teamCountLabel(total: number): string {
  if (total === 0) return "No teams yet";
  if (total === 1) return "1 team registered so far";
  return `${total} teams registered so far`;
}

/**
 * The filename a downloaded crest card lands under.
 *
 * Team names arrive from a text box at a stand, so anything could be in one.
 * Everything outside a-z, 0-9 becomes a hyphen, which leaves a name that every
 * phone's downloads folder accepts and that the owner still recognises.
 */
export function crestFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `mmrc26-crest-${slug || "team"}.png`;
}

/* -------------------------------------------------------------------------- */
/* The crest card                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The card a visitor can take away, at a size Instagram and WhatsApp both
 * accept without re-cropping it.
 */
export const CREST_CARD = { width: 1080, height: 1350 } as const;

/**
 * Text going into hand-built SVG markup, made safe.
 *
 * The name comes from a text box at a stand, so anything at all can be in it.
 * Without this, an ampersand alone produces a file no renderer will open, and
 * a name containing a tag would be markup rather than a name.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Names longer than this are cut on the card, which has one line for them. */
export const CARD_NAME_MAX = 28;

/**
 * Point size for a name on the card.
 *
 * Stepped rather than measured: the card is drawn as SVG markup with no
 * layout engine to ask how wide a string is, and three steps keep every name
 * that fits in CARD_NAME_MAX inside the card at a weight still worth looking
 * at.
 */
export function crestNameFontSize(name: string): number {
  const length = name.trim().length;
  if (length <= 12) return 92;
  if (length <= 20) return 68;
  return 52;
}

export function cardName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.length > CARD_NAME_MAX ? `${trimmed.slice(0, CARD_NAME_MAX - 1)}…` : trimmed;
}

/**
 * The take-away card, as standalone SVG markup.
 *
 * Built as a string rather than as a component because its only two jobs are
 * to be shown as an image and to be rasterised into a PNG a visitor can keep.
 * That also means it cannot inherit a single thing from the page: no fonts, no
 * theme variables, no CSS. Every colour is written out, and the font is a
 * stack every phone already has, because a card that renders in Chrome and
 * comes out blank on somebody's iPhone is worse than no card.
 *
 * Deliberately one drawing, not two. The page shows this same markup as the
 * preview, so what a visitor downloads is what they were looking at.
 */
export function crestCardSvg({ name, maze }: { name: string; maze: Maze }): string {
  const display = cardName(name);
  const label = escapeXml(display);
  const nameSize = crestNameFontSize(display);
  const { width, height } = CREST_CARD;

  const panel = 700;
  const panelX = (width - panel) / 2;
  const panelY = 300;
  const inset = 46;
  const font = "Arial, Helvetica, sans-serif";

  const walls = maze.walls.map((d) => `<path d="${d}" />`).join("");
  const route = maze.routes[0]?.solution ?? "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="#5F2167"/><stop offset="1" stop-color="#2A0E31"/>`,
    `</linearGradient></defs>`,
    `<rect width="${width}" height="${height}" fill="url(#bg)"/>`,
    `<rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="36" fill="none" stroke="${MAZE_GOLD}" stroke-opacity="0.55" stroke-width="3"/>`,
    `<text x="${width / 2}" y="150" text-anchor="middle" font-family="${font}" font-size="74" font-weight="700" letter-spacing="8" fill="${MAZE_GOLD}">MMRC26</text>`,
    `<text x="${width / 2}" y="208" text-anchor="middle" font-family="${font}" font-size="32" letter-spacing="10" fill="#FFFFFF" fill-opacity="0.78">IEEE RAS HTU</text>`,
    `<rect x="${panelX}" y="${panelY}" width="${panel}" height="${panel}" rx="40" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2"/>`,
    `<svg x="${panelX + inset}" y="${panelY + inset}" width="${panel - inset * 2}" height="${panel - inset * 2}" viewBox="${maze.viewBox}">`,
    `<rect x="${maze.goal.x + 2}" y="${maze.goal.y + 2}" width="${maze.goal.size - 4}" height="${maze.goal.size - 4}" rx="3" fill="${MAZE_GOLD}" fill-opacity="0.16" stroke="${MAZE_GOLD}" stroke-width="2"/>`,
    route
      ? `<path d="${route}" fill="none" stroke="${MAZE_GOLD}" stroke-opacity="0.9" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
      : "",
    `<g fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round">${walls}</g>`,
    `<rect x="0" y="0" width="${maze.size * CELL}" height="${maze.size * CELL}" fill="none" stroke="#FFFFFF" stroke-width="2.6"/>`,
    `</svg>`,
    `<text x="${width / 2}" y="1130" text-anchor="middle" font-family="${font}" font-size="${nameSize}" font-weight="700" fill="#FFFFFF">${label}</text>`,
    `<text x="${width / 2}" y="1192" text-anchor="middle" font-family="${font}" font-size="30" fill="#FFFFFF" fill-opacity="0.7">Every name makes a different maze</text>`,
    `<text x="${width / 2}" y="1288" text-anchor="middle" font-family="${font}" font-size="30" letter-spacing="4" fill="${MAZE_GOLD}">mmrchtu.tech</text>`,
    `</svg>`,
  ].join("");
}

/* -------------------------------------------------------------------------- */
/* Choosing a maze worth watching                                              */
/* -------------------------------------------------------------------------- */

/**
 * How much dearer the search run has to be than the speed run.
 *
 * The explainer's whole argument is that exploring costs something. Over four
 * hundred mazes the median is about four times, but a quarter of them come in
 * under two, and on one of those the captions read "51 moves to learn it, 37
 * to run it", which argues the opposite of what it is there to argue.
 */
export const TEACHING_RATIO = 2.5;

/** Six tries. Sixty per cent of mazes clear the bar, so missing is rare. */
export const TEACHING_ATTEMPTS = 6;

/** What the explainer's two captions will say, as a multiple. */
export function teachingRatio(maze: Maze): number {
  const runs = compareRuns(maze);
  return runs.search.moves / Math.max(1, runs.speed.length - 1);
}

/**
 * A real maze, chosen for making the point clearly.
 *
 * Nothing here is staged: every candidate comes from the competition's own
 * generator and the numbers shown are that maze's real numbers. The only
 * judgement being applied is the one a person would apply setting up a stand,
 * which is not to demonstrate on the one maze where exploring happens to be
 * nearly free.
 *
 * Falls back to the best of what it saw rather than looping until it wins, so
 * a phone never spends an unbounded amount of time on a maze it is about to
 * draw at 420 pixels.
 */
export function teachingMaze(rand: Rand = Math.random, attempts = TEACHING_ATTEMPTS): Maze {
  let best = generateMaze(RULES.mazeGrid, rand, DIAGRAM_BRAID);
  let bestRatio = teachingRatio(best);

  for (let i = 1; i < attempts && bestRatio < TEACHING_RATIO; i++) {
    const candidate = generateMaze(RULES.mazeGrid, rand, DIAGRAM_BRAID);
    const ratio = teachingRatio(candidate);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }

  return best;
}
