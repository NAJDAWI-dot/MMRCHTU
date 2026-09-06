/**
 * The MMRC 26 logo: the maze mark, on the ground it was drawn for.
 *
 * The supplied artwork is one maze glyph split down the middle — the left half
 * white, the right half black. That positive/negative split is the idea in the
 * mark, and it only works over a mid-tone: on the site's cream the white half
 * disappears entirely, and on the dark theme the black half does. So rather
 * than recolour somebody else's logo, the mark sits on a plate, which is what
 * both approved backgrounds in the source file are.
 *
 * The plate is a tint of the brand purple rather than the source file's grey.
 * It was chosen to behave the same way the designer's own background does —
 * black assertive at about 11:1, white a deliberate ghost at about 1.9:1 — so
 * the mark reads exactly as drawn, in a colour that belongs to this site.
 *
 * The wordmark beside it is live text in Bevan, the logo's own typeface, not a
 * picture of it: it stays crisp at any size, recolours with the theme, and is
 * selectable and searchable like the text it is.
 */

/** The ground the mark is drawn on. See the note above before changing it. */
const PLATE = "#cdb2d1";

interface MmrcLogoProps {
  className?: string;
  /** Tailwind height classes for the plate; the mark scales to fit. */
  size?: string;
  /** Drop the words and show the mark alone. */
  markOnly?: boolean;
}

export function MmrcLogo({
  className = "",
  size = "h-9 sm:h-10",
  markOnly = false,
}: MmrcLogoProps) {
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <span
        style={{ backgroundColor: PLATE }}
        /*
          inline-flex, not grid. A grid row is content-sized, so a percentage
          height on the child resolves against a track the child itself
          defines — the mark drove the row to its intrinsic 247px and burst
          out of the header. A flex item resolves its height against the
          definite one set here instead.
        */
        className={`inline-flex shrink-0 items-center justify-center rounded-lg p-1 shadow-sm ring-1 ring-ras-purple/15 dark:ring-white/20 ${size}`}
      >
        {/*
          A plain <img>: this is a fixed-size brand asset shown at about 32px,
          so there is nothing for next/image to optimise that is worth the
          request it would add. Empty alt because the words beside it — or the
          link's own label — already name it, and a screen reader announcing
          "MMRC 26 logo, MMRC 26" is worse than silence.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimisation to gain */}
        <img
          src="/brand/logo/mmrc-mark.png"
          alt=""
          width={249}
          height={247}
          className="h-full w-auto object-contain"
        />
      </span>

      {markOnly ? null : (
        // Never truncated. A wordmark with an ellipsis in it is not a
        // wordmark; below `sm` it steps aside for the mark instead.
        <span className="hidden whitespace-nowrap font-brand text-base leading-none text-ras-purple dark:text-white sm:inline sm:text-lg">
          MMRC 26
        </span>
      )}
    </span>
  );
}
