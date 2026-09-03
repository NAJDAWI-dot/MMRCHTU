import { isEarlyBirdActive, type EarlyBirdConfig } from "@/lib/pricing";

/**
 * How the early-bird discount is advertised, as opposed to how it is charged.
 *
 * pricing.ts answers what a team owes. This answers what the site says out loud
 * about the offer, which is a different question with a different audience:
 * nothing here reaches an amount, and everything here reaches a page that
 * somebody who has not registered yet can see.
 *
 * The pure half, with no database and no React in it, so the phone menu and the
 * checklist can import the label without dragging Prisma into the browser
 * bundle. The read is getEarlyBirdState in site-config.ts — the same division,
 * for the same reason, as pages.ts and page-visibility.ts.
 */

/** The promotional word, defined once so five call sites cannot disagree. */
export const EARLY_BIRD_LABEL_AR = "تخفيضات";

/**
 * Whether the discount is running, and on what terms.
 *
 * A discriminated union rather than an object with nullable fields and a flag.
 * A caller holding `{ active: false, percent: 20 }` is one stray `&&` away from
 * advertising a discount that is not running; here the percentage and the
 * deadline do not exist to be read until `active` has been checked, and the
 * compiler is what enforces it rather than a convention.
 */
export type EarlyBirdState =
  | { active: false }
  | { active: true; percent: number; cutoff: Date };

/**
 * Derives what the site should say from what the admin configured.
 *
 * The cutoff is re-checked after isEarlyBirdActive purely to narrow the type:
 * that function already guarantees a cutoff exists before returning true, but
 * it returns a plain boolean and cannot tell the compiler so.
 */
export function earlyBirdState(config: EarlyBirdConfig, now: Date = new Date()): EarlyBirdState {
  if (!isEarlyBirdActive(config, now) || !config.earlyBirdCutoff) {
    return { active: false };
  }

  return {
    active: true,
    percent: config.earlyBirdPercent,
    cutoff: config.earlyBirdCutoff,
  };
}
