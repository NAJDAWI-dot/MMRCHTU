/**
 * What Cheddar says and does when a team finishes registering.
 *
 * Free of React and the DOM, like the rest of `lib`, so the part that is easy
 * to get wrong — picking a line and a move fairly, from an injected source of
 * randomness — is tested directly rather than by watching a mouse jump around.
 *
 * The quip, the move and the drawing are chosen independently. Twelve lines,
 * six moves and five drawings is three hundred and sixty combinations, which is
 * what makes "everyone gets a different one" true in practice for a competition
 * this size rather than merely technically.
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

/**
 * The drawings Cheddar can turn up as.
 *
 * Five hand-drawn variations, prepared from mouse_SVG/ by
 * scripts/prepare-cheddar-svgs.mjs. Referenced by URL rather than inlined, so
 * a visitor who never registers never fetches one.
 *
 * The raster copies rather than the vectors beside them. The sources are traced
 * *from* drawings, so there is no vector detail underneath to lose, and the
 * difference is 65KB against 900KB each — which stopped being a detail once the
 * landing page began showing one every thirty seconds rather than once at the
 * end of a registration.
 *
 * The alt text describes each drawing rather than repeating "Cheddar", because
 * which one you got is the whole point of there being five.
 */
export interface CheddarPortrait {
  src: string;
  alt: string;
}

export const CHEDDAR_PORTRAITS: readonly CheddarPortrait[] = [
  { src: "/brand/cheddar/cheddar-1.webp", alt: "Cheddar standing with his paws folded" },
  { src: "/brand/cheddar/cheddar-2.webp", alt: "Cheddar's face, ears wide, tongue out" },
  { src: "/brand/cheddar/cheddar-3.webp", alt: "Cheddar mid-scurry with his tail curled" },
  { src: "/brand/cheddar/cheddar-4.webp", alt: "Cheddar peering sideways, one eye huge" },
  { src: "/brand/cheddar/cheddar-5.webp", alt: "Cheddar as a unicorn, horn and all" },
] as const;

export interface Celebration {
  quip: string;
  move: CheddarMove;
  portrait: CheddarPortrait;
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
    portrait: pick(CHEDDAR_PORTRAITS, random()),
  };
}

/**
 * Nothing is remembered between celebrations.
 *
 * There was a `mmrc26.cheddar.seen` flag here. It was written when the overlay
 * mounted, so anything that mounted it once suppressed it permanently — and
 * because the flag lived in the visitor's browser, neither they nor we could
 * clear it. "Once per browser" was also the wrong grain for something that
 * marks the end of a registration: a team does one of those, and a shared lab
 * machine should not eat the next team's turn. He now simply appears when a
 * registration completes, which is once per team by construction.
 */

/**
 * Cheddar does not let himself out on a timer.
 *
 * He used to, after nine seconds. But he now carries the only on-screen
 * statement that the registration is complete and how long verification takes,
 * and he offers a choice of where to go next — so snatching all of that away
 * from someone still reading it would be worse than leaving it up. Escape and
 * both buttons dismiss him, so he is never a trap.
 */

/** The fade, which must match the CSS or the overlay is torn out mid-transition. */
export const CELEBRATION_FADE_MS = 320;
