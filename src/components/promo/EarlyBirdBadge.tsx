import { EARLY_BIRD_LABEL_AR } from "@/lib/early-bird";

/**
 * The discount pill that marks a registration call to action.
 *
 * Presentational only, and deliberately free of any data fetching: whether the
 * discount is running is decided once per request and handed down, which is
 * what lets the same component sit in the server-rendered nav and in the
 * client-rendered phone menu without two ways of asking.
 *
 * Two placements, chosen by prop rather than by overriding classes from
 * outside. That is not a style preference: `absolute` and `static` are both
 * position utilities, and which one wins is decided by their order in
 * Tailwind's stylesheet, not by the order they appear in the class attribute.
 * A caller appending "static" to override "absolute" silently loses, and the
 * pill goes on floating against whatever ancestor happens to be positioned.
 * Selecting the whole set here means there is never a conflict to resolve.
 *
 * ras-crimson rather than the accent token because this is a filled background
 * with white on it, not brand ink being read against the page — see the note on
 * the accent colour in tailwind.config.ts.
 *
 * The halo and its slow pulse live in globals.css under .eb-glow, because a
 * keyframed shadow is not something Tailwind expresses and because the pulse
 * has to be dropped under reduced motion without losing the glow itself.
 */
export function EarlyBirdBadge({
  /**
   * "float" hangs the pill over the top edge of the control it marks, and needs
   * `relative` on that control or a wrapper. "inline" sets it after the label
   * on the same line — for stacked or wrapping link lists, where a floating
   * pill lands on a neighbouring row instead of its own.
   */
  placement = "float",
  className = "",
}: {
  placement?: "float" | "inline";
  className?: string;
}) {
  const position =
    placement === "float"
      ? "pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2"
      // A physical left margin, not the logical ms-2: this span sets dir="rtl"
      // for the Arabic, which flips "inline-start" to the right and leaves the
      // pill touching the English label it follows.
      : "relative ml-2 align-middle";

  return (
    <span
      dir="rtl"
      lang="ar"
      // The word repeats whatever it is pinned to and says nothing a screen
      // reader needs twice; the banner and the notice on the register page
      // carry the actual offer. So it is announced as what it is, once, and
      // takes no tab stop.
      aria-label="Early bird discount"
      className={`inline-flex select-none items-center whitespace-nowrap eb-glow rounded-full bg-ras-crimson px-2 py-0.5 font-arabic text-[10px] font-bold leading-none text-white ring-1 ring-white/60 dark:bg-mood-rose dark:ring-white/25 ${position} ${className}`}
    >
      {EARLY_BIRD_LABEL_AR}
    </span>
  );
}
