/**
 * What Cheddar says and does when a team finishes registering.
 *
 * Free of React and the DOM, like the rest of `lib`, so the part that is easy
 * to get wrong — picking a line and a move fairly, from an injected source of
 * randomness — is tested directly rather than by watching a mouse jump around.
 *
 * The quip and the move are chosen independently. Twelve lines and six moves
 * is seventy-two combinations, which is what makes "everyone gets a different
 * one" true in practice for a competition this size rather than merely
 * technically.
 */

/**
 * Cheddar's material.
 *
 * Written to be read once, by someone who has just spent ten minutes typing
 * their team's details and transferring money — so: short, warm, and never at
 * the expense of the person reading it. The joke is always on Cheddar or on
 * the maze, never on the team.
 */
export const CHEDDAR_QUIPS: readonly string[] = [
  "Cheese secured. Now go build something that can find it.",
  "You're in! Your robot has no idea what's coming. Neither do we.",
  "Registered! I'd shake your hand, but look at these paws.",
  "One small click for you, one giant maze for your mouse.",
  "Payment received. I counted it myself. Twice. With my paws.",
  "Somewhere, a maze is being built specifically to ruin your afternoon.",
  "You're on the list! Please do not feed the other robots.",
  "I've seen the maze. I'm not allowed to say anything. Good luck.",
  "Your team is registered and my cheese is unguarded. Coincidence?",
  "Welcome aboard. Wheels down, sensors up, chin up.",
  "Congratulations! You now have a deadline and a dream.",
  "Signed, sealed, delivered, and a little bit cheesy.",
] as const;

/** How Cheddar behaves once he is on screen. Each maps to a CSS animation. */
export type CheddarMove = "scurry" | "backflip" | "spin" | "peek" | "moonwalk" | "bounce";

export const CHEDDAR_MOVES: readonly CheddarMove[] = [
  "scurry",
  "backflip",
  "spin",
  "peek",
  "moonwalk",
  "bounce",
] as const;

export interface Celebration {
  quip: string;
  move: CheddarMove;
}

/**
 * Picks one item using a value expected in [0, 1).
 *
 * Clamped rather than trusted: `Math.random` honours the contract, but this
 * function also takes whatever a caller passes, and an out-of-range value would
 * otherwise index past the end and hand back `undefined` — which reaches the
 * screen as a blank speech bubble at the one moment that is supposed to be fun.
 */
function pick<T>(items: readonly T[], value: number): T {
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999_999_999) : 0;
  return items[Math.floor(safe * items.length)]!;
}

/**
 * One quip and one move.
 *
 * `random` is injected for the same reason `splashHoldMs` takes its duration
 * rather than reading a clock: a test should be able to ask for the seventh
 * quip and the third move without running the lottery until it wins.
 */
export function pickCelebration(random: () => number = Math.random): Celebration {
  return {
    quip: pick(CHEDDAR_QUIPS, random()),
    move: pick(CHEDDAR_MOVES, random()),
  };
}

/**
 * Records that this browser has met Cheddar.
 *
 * Deliberately `localStorage` and not the database: this is a bit of delight,
 * not a fact about the registration, and it is not worth a column or a write
 * on the submit path. The cost of being wrong is that somebody sees a mouse
 * twice.
 */
export const CELEBRATION_SEEN_KEY = "mmrc26.cheddar.seen";

/**
 * How long Cheddar stays before letting himself out.
 *
 * Long enough to read a line and smile, short enough that a team who has
 * wandered off to tell someone comes back to their confirmation rather than to
 * a mouse. The confirmation underneath carries the resume code, so nothing here
 * may hold it hostage.
 */
export const CELEBRATION_AUTO_MS = 9000;

/** The fade, which must match the CSS or the overlay is torn out mid-transition. */
export const CELEBRATION_FADE_MS = 320;
