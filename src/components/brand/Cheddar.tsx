/**
 * Cheddar, the competition's mouse.
 *
 * Drawn from the "MEET CHEDDAR" playbill in public/brand/cheddar-poster.jpg:
 * one continuous pear — head running straight into a wide body with no neck —
 * oversized round ears set high and wide, big amber-ringed eyes, and paws
 * folded over the belly.
 *
 * Inline SVG rather than the poster itself, for three reasons. The poster is a
 * JPEG, so it has no transparency and would sit on the page as a beige
 * rectangle. It carries curtains and a wordmark that are set dressing, not the
 * character. And a flat image cannot move: everything below that needs to
 * animate independently — ears, tail, eyes, the whole body — carries its own
 * class so CSS can drive it while this file stays a static drawing. The same
 * arrangement as MazeTrail, whose own "mouse" is an abstract dot and is not a
 * character.
 *
 * No network request, no layout shift, and legible at 40px or 400px.
 */

/** Poster colours, kept literal so he is the same mouse on either theme. */
const FUR = "#adacb2";
const FUR_SHADE = "#8f8e96";
const INK = "#37333d";
const EAR_INNER = "#8a8790";
const EYE = "#2b2831";
const EYE_RING = "#d9b978";
const GLINT = "#fffdf7";

export type CheddarPose = "stand" | "run" | "peek";

interface CheddarProps {
  /** Rendered width in px; height follows the aspect ratio. */
  size?: number;
  className?: string;
  pose?: CheddarPose;
  /**
   * Accessible name. Omit it — the default — and he is decoration, which is
   * usually right: he appears beside text that already says what happened.
   */
  title?: string;
}

export function Cheddar({ size = 120, className = "", pose = "stand", title }: CheddarProps) {
  return (
    <svg
      viewBox="0 0 100 124"
      width={size}
      height={(size * 124) / 100}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`cheddar cheddar-${pose} ${className}`.trim()}
      // The parts animate around their own centres rather than the corner of
      // the viewBox, which is what makes an ear wiggle instead of swing.
      style={{ overflow: "visible" }}
    >
      {/* Tail first, so the body covers where it joins. */}
      <path
        className="cheddar-tail"
        d="M74 99c11-1 16-9 13-16"
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      {/* Ears sit behind the head so the join needs no seam. */}
      <g className="cheddar-ear cheddar-ear-l">
        <circle cx="26" cy="41" r="14.5" fill={FUR} stroke={INK} strokeWidth="2.4" />
        <circle cx="27" cy="42" r="9" fill={EAR_INNER} />
      </g>
      <g className="cheddar-ear cheddar-ear-r">
        <circle cx="74" cy="41" r="14.5" fill={FUR} stroke={INK} strokeWidth="2.4" />
        <circle cx="73" cy="42" r="9" fill={EAR_INNER} />
      </g>

      {/* The little tuft on top of his head, slightly off-centre as drawn.
          Kept short and round-jointed: any taller and it stops reading as a
          bump in his fur and starts reading as a horn. */}
      <path
        d="M53 26l3-5 2.5 6z"
        fill={FUR}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Head and body: one shape, fat end down. */}
      <path
        className="cheddar-torso"
        d="M50 26c13 0 22 8 23.5 21C75.5 62 78 76 78 90c0 14-12 22-28 22s-28-8-28-22c0-14 2.5-28 4.5-43C28 34 37 26 50 26z"
        fill={FUR}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* The seam across the belly on the poster. */}
      <path
        d="M24.5 83c16 5 35 5 51 0"
        fill="none"
        stroke={FUR_SHADE}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Whiskers, three a side, before the eyes so they tuck underneath. */}
      <g stroke={INK} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M38 63L19 58M38 66L17 66M38 69L19 74" />
        <path d="M62 63l19-5M62 66l21 0M62 69l19 5" />
      </g>

      <g className="cheddar-eyes">
        <circle cx="41" cy="52" r="8.6" fill={EYE} stroke={EYE_RING} strokeWidth="2.6" />
        <circle cx="59" cy="52" r="8.6" fill={EYE} stroke={EYE_RING} strokeWidth="2.6" />
        <circle className="cheddar-glint" cx="38.4" cy="49" r="2.7" fill={GLINT} />
        <circle className="cheddar-glint" cx="56.4" cy="49" r="2.7" fill={GLINT} />
      </g>

      {/* Snout: a small smile and the dot beside it. */}
      <path
        d="M44 63c3 3.4 9 3.4 12 0"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="57.5" cy="67.5" r="1.7" fill={INK} />

      {/* Paws folded over the belly. */}
      <g className="cheddar-paws">
        <path
          d="M32 70c3.5 5.5 9 8.5 15 8.5"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M68 70c-3.5 5.5-9 8.5-15 8.5"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Level with each other and overlapping in the middle, so they read as
            one pair of clasped paws rather than two stray lumps. */}
        <ellipse cx="46" cy="78.5" rx="6.6" ry="4.8" fill={FUR} stroke={INK} strokeWidth="2.2" />
        <ellipse cx="54" cy="78.5" rx="6.6" ry="4.8" fill={FUR} stroke={INK} strokeWidth="2.2" />
      </g>

      <g className="cheddar-feet">
        <ellipse className="cheddar-foot-l" cx="38" cy="111" rx="9" ry="5.4" fill={FUR} stroke={INK} strokeWidth="2.2" />
        <ellipse className="cheddar-foot-r" cx="62" cy="111" rx="9" ry="5.4" fill={FUR} stroke={INK} strokeWidth="2.2" />
      </g>
    </svg>
  );
}
