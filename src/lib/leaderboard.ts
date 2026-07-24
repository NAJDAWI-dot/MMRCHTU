/**
 * Shared leaderboard rules. Imported by both the API route and the client
 * components so the name a player types is validated the same way on each side.
 */

export const GAME_MODES = ["classic", "fp"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  classic: "Classic Maze",
  fp: "First-Person",
};

export const MAX_NAME_LENGTH = 16;

export function isGameMode(value: string): value is GameMode {
  return (GAME_MODES as readonly string[]).includes(value);
}

/**
 * Trims, collapses runs of whitespace, and strips control characters from a
 * submitted player name. Returns "" for anything that leaves nothing usable —
 * callers treat that as "no name entered".
 */
export function sanitisePlayerName(raw: string): string {
  // Control characters are dropped by code point rather than by regex: they
  // would otherwise render as invisible junk on the board. Whitespace controls
  // (tab, newline) are kept here and collapsed to single spaces below.
  const printable = [...raw]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      const isControl = code < 0x20 || (code >= 0x7f && code <= 0x9f);
      return !isControl || /\s/.test(ch);
    })
    .join("");

  return printable.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  level: number;
  createdAt: string;
}

/** Payload of the `pacmouse:gameover` event the canvas games dispatch. */
export interface GameOverDetail {
  mode: GameMode;
  score: number;
  level: number;
}

export const GAME_OVER_EVENT = "pacmouse:gameover";
