/**
 * Splash-screen policy and timings.
 *
 * Deliberately free of React and of any direct DOM access so the decision
 * ("does this visitor see the splash, and for how long?") can be tested on its
 * own. The component reads the environment and hands the answers in.
 */

/** Survives navigation within a tab, cleared when the tab closes. */
export const SPLASH_SESSION_KEY = "mmrc26-splash-seen";

/**
 * Set on <html> by a pre-paint inline script when the splash is due, and
 * removed once it finishes. The overlay is always in the server-rendered
 * markup and hidden by default, so this class — not a client-side mount — is
 * what reveals it. That ordering is what keeps the real page from flashing
 * behind the splash for a frame.
 */
export const SPLASH_PENDING_CLASS = "splash-pending";

/** Added alongside the pending class to trigger the fade-out transition. */
export const SPLASH_DONE_CLASS = "splash-done";

/** Long enough for the mouse to run the maze and the lockup to settle. */
export const SPLASH_FULL_MS = 2200;
/**
 * Reduced-motion visitors still get the brand moment, just as a static hold
 * rather than a trip through the maze.
 */
export const SPLASH_BRIEF_MS = 600;
/** Must match the CSS fade duration, or the overlay is torn out mid-fade. */
export const SPLASH_FADE_MS = 400;

export type SplashMode = "full" | "brief" | "none";

export interface SplashConditions {
  /** Already played once in this tab. */
  seen: boolean;
  /** The visitor asked the OS to minimise animation. */
  reducedMotion: boolean;
}

/**
 * `reducedMotion` downgrades rather than skips: the point of that setting is
 * to avoid vestibular triggers from large moving imagery, not to opt out of
 * branding, so the logo still shows — it just doesn't travel.
 */
export function splashMode({ seen, reducedMotion }: SplashConditions): SplashMode {
  if (seen) return "none";
  return reducedMotion ? "brief" : "full";
}

/** How long the overlay holds at full opacity before it starts fading. */
export function splashHoldMs(mode: SplashMode): number {
  if (mode === "none") return 0;
  return mode === "brief" ? SPLASH_BRIEF_MS : SPLASH_FULL_MS;
}

/**
 * The pre-paint script, as source text for a `dangerouslySetInnerHTML` script
 * tag in <head>.
 *
 * Kept tiny and wrapped in try/catch because it runs before anything else on
 * the page: sessionStorage throws in some privacy modes, and a throw here
 * would leave the overlay hidden and the site looking normal — the safe way
 * to fail. Constants are interpolated so this can never drift from the values
 * the component and the CSS use.
 */
export function splashPrePaintScript(): string {
  return (
    `(function(){try{` +
    `if(sessionStorage.getItem(${JSON.stringify(SPLASH_SESSION_KEY)}))return;` +
    `document.documentElement.classList.add(${JSON.stringify(SPLASH_PENDING_CLASS)});` +
    `}catch(e){}})();`
  );
}
