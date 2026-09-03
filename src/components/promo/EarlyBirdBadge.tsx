import { EARLY_BIRD_LABEL_AR } from "@/lib/early-bird";

/**
 * The discount pill that rides on top of a registration button.
 *
 * Presentational only, and deliberately free of any data fetching: whether the
 * discount is running is decided once per request by lib/early-bird and handed
 * down, which is what lets the same component sit in the server-rendered nav
 * and in the client-rendered phone menu without two ways of asking.
 *
 * Positioned absolutely, so whatever it is attached to needs `relative` on it
 * or on a wrapper. Pass className to override that — the checklist on the rules
 * page sets it back to `static`, since a pill floating over a line of 12px text
 * reads as a rendering fault rather than a badge.
 *
 * ras-crimson rather than the accent token because this is a filled background
 * with white on it, not brand ink being read against the page — see the note on
 * the accent colour in tailwind.config.ts.
 */
export function EarlyBirdBadge({ className = "" }: { className?: string }) {
  return (
    <span
      dir="rtl"
      lang="ar"
      // The word repeats whatever it is pinned to and says nothing a screen
      // reader needs twice; the banner and the notice on the register page
      // carry the actual offer. So it is announced as what it is, once, and
      // takes no tab stop.
      aria-label="Early bird discount"
      className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 select-none whitespace-nowrap rounded-full bg-ras-crimson px-2 py-0.5 font-arabic text-[10px] font-bold leading-none text-white shadow-sm ring-1 ring-white/50 dark:ring-black/40 ${className}`}
    >
      {EARLY_BIRD_LABEL_AR}
    </span>
  );
}
