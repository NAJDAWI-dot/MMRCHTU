/**
 * When the between-pages loader shows, and for how long.
 *
 * Next 14's App Router publishes no navigation events — `useLinkStatus` arrives
 * in 15 — so the loader cannot ask the router when a navigation starts. It has
 * to notice the click itself. Deciding *which* clicks count is fiddly enough
 * (modifier keys, new tabs, downloads, other origins, same page) to be worth
 * separating from the component and testing on its own, which is what this file
 * is for.
 *
 * Free of React and the DOM: `shouldInterceptClick` takes a plain description
 * of a click rather than a MouseEvent, so a test does not have to build one.
 */

/**
 * The deliberate hold.
 *
 * Most of these pages render in single-digit milliseconds, so without a floor
 * the loader would appear and vanish inside one frame and read as a flicker or
 * a fault. This is the requested "take its time" — long enough to register as a
 * transition, short enough that clicking through the nav does not feel like
 * being held up. Past about a second a deliberate delay stops reading as
 * intentional and starts reading as a slow site.
 */
export const ROUTE_LOADER_MIN_MS = 700;

/** Must match the CSS fade, or the overlay is removed mid-transition. */
export const ROUTE_LOADER_FADE_MS = 250;

/**
 * Backstop.
 *
 * The loader is shown on a click and hidden when the path changes — but a
 * navigation can be cancelled, blocked, or simply never arrive, and none of
 * those are allowed to leave the site sitting behind a curtain it cannot lift.
 * Generous enough that a genuinely slow route still gets its loader.
 */
export const ROUTE_LOADER_SAFETY_MS = 8000;

/**
 * Everything about a click that matters, without requiring a real event.
 *
 * `href` is the anchor's resolved absolute URL — the browser resolves relative
 * hrefs for us via the `href` property, so callers should read that rather than
 * the attribute.
 */
export interface ClickIntent {
  /** Resolved absolute URL of the anchor, or null when the click hit no link. */
  href: string | null;
  /** The anchor's target attribute, if any. */
  target?: string | null;
  /** Whether the anchor carries a download attribute. */
  download?: boolean;
  /** 0 is the primary button; anything else opens elsewhere or does nothing. */
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /** Whether something upstream has already handled this click. */
  defaultPrevented?: boolean;
}

/**
 * Whether this click is an in-app navigation the loader should cover.
 *
 * Deliberately conservative: every branch below answers false, and the only way
 * to reach true is to be an ordinary left-click on a same-origin link to a
 * different path. Being wrong in that direction costs a missing animation;
 * being wrong the other way puts an overlay over a page the visitor never left.
 */
export function shouldInterceptClick(
  intent: ClickIntent,
  currentPath: string,
  origin: string,
): boolean {
  const { href, target, download, button = 0, defaultPrevented } = intent;

  if (!href) return false;
  if (defaultPrevented) return false;
  // Middle- and right-clicks are "open elsewhere" and "show me a menu".
  if (button !== 0) return false;
  // Every modifier here means a new tab, a new window, or a save.
  if (intent.metaKey || intent.ctrlKey || intent.shiftKey || intent.altKey) return false;
  if (download) return false;
  if (target && target !== "" && target !== "_self") return false;

  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return false;
  }

  // mailto:, tel:, and anything else that hands off to another application.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  // Another site: the browser leaves, and our overlay goes with the page.
  if (url.origin !== origin) return false;
  // A jump within the page. The path never changes, so the loader would have
  // nothing to wait for and would sit there until the safety timer.
  if (url.pathname === currentPath) return false;

  return true;
}

/**
 * How much longer the loader must stay up.
 *
 * Zero once the floor has already passed, which is the common case on a slow
 * route — the hold is a minimum, never an addition.
 */
export function remainingHoldMs(
  startedAt: number,
  now: number,
  minMs: number = ROUTE_LOADER_MIN_MS,
): number {
  const elapsed = now - startedAt;
  if (!Number.isFinite(elapsed)) return minMs;
  // Elapsed is floored at zero before it is subtracted. A negative one means
  // the clock moved backwards between the click and the arrival, and without
  // this that would be *added* to the hold — a stopped-looking overlay for as
  // long as the jump. `minMs` is the ceiling on this wait as well as its floor.
  return Math.max(0, minMs - Math.max(0, elapsed));
}
