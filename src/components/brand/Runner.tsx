/**
 * The runner: the person chasing Cheddar along the bottom of the screen.
 *
 * Drawn here rather than traced from the own.svg the character came from, and
 * it had to be. That file is a 668KB autotrace of a photograph — a
 * head-and-shoulders bust cropped at the chest, with no arms below the elbow
 * and no legs at all. A bust cannot run. So this is the same person built as a
 * cartoon: the curly dark hair, the round glasses, the moustache and short
 * beard, and the red Morocco shirt with its gold trim and green crest, on a
 * body that has limbs to move.
 *
 * Deliberately in Cheddar's register rather than the photograph's — same ink
 * colour, same flat fills, same stroke weights, and a head sized well out of
 * proportion to the body. A realistically-proportioned figure beside him would
 * put the face at about fifteen pixels, where none of the features that make it
 * recognisable survive; and a shaded, traced human next to a flat cartoon mouse
 * reads as two drawings from two different places rather than one chase.
 *
 * Everything that moves — each leg, each arm — carries its own class so the CSS
 * drives it while this file stays a static drawing, the same arrangement
 * Cheddar uses.
 */

/** Cheddar's outline colour, so the two read as one pair rather than two. */
const INK = "#37333d";

const HAIR = "#2b1d15";
const HAIR_LIT = "#4a3324";
const SKIN = "#cf9469";
const SKIN_SHADE = "#b0764c";
const FRAME = "#241f22";
/** The shirt, its shade, and the gold trim: Morocco's home kit. */
const SHIRT = "#c40d1c";
const SHIRT_SHADE = "#96040f";
const GOLD = "#e0a822";
const CREST = "#0e594e";
const SHORTS = "#123f37";
const SHOE = "#33303a";

/**
 * The forward lean, applied to everything above the hips.
 *
 * Legs alone do not read as running — a figure with cycling legs and a plumb
 * upright body reads as marching on the spot. Tipping the shoulders over the
 * hip point the legs already pivot around is what turns it into a run, and it
 * has to be a static SVG transform rather than a CSS one because the limb
 * groups inside use CSS transforms for their swing, and CSS would win.
 */
const LEAN = "rotate(-9 50 108)";

interface RunnerProps {
  className?: string;
}

/**
 * Faces left, matching the mice: the chase flips the whole group with
 * `scaleX(-1)` when it travels the other way, so only one drawing is needed.
 */
export function Runner({ className = "" }: RunnerProps) {
  return (
    <svg
      viewBox="0 0 100 152"
      className={`runner ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      {/*
        The trailing arm, behind the torso. Each arm starts at its own shoulder
        rather than at the sleeve opening, and the sleeve is painted over the
        top of it afterwards — so the joint stays put however far the arm
        swings, instead of tearing away from the shirt at the extremes.
      */}
      <g transform={LEAN}>
        <g className="runner-arm runner-arm--back">
          <path
            d="M67 88 L75 101 L72 114"
            fill="none"
            stroke={SKIN_SHADE}
            strokeWidth="6.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="72" cy="115" r="3.7" fill={SKIN_SHADE} />
        </g>
      </g>

      {/* Both legs before the shorts, so the hem covers where they join. */}
      <g className="runner-leg runner-leg--a">
        <path
          d="M46 106 L41 126 L43 142"
          fill="none"
          stroke={SKIN}
          strokeWidth="8.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="39" cy="145" rx="7.4" ry="3.8" fill={SHOE} stroke={INK} strokeWidth="1.6" />
      </g>
      <g className="runner-leg runner-leg--b">
        <path
          d="M54 106 L59 126 L57 142"
          fill="none"
          stroke={SKIN_SHADE}
          strokeWidth="8.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="53" cy="145" rx="7.4" ry="3.8" fill={SHOE} stroke={INK} strokeWidth="1.6" />
      </g>

      {/* Notched between the legs, or the shorts read as a skirt. */}
      <path
        d="M32 99 Q50 107 68 99 L67 114 Q58 117 55 114 L50 108 L45 114 Q42 117 33 114 Z"
        fill={SHORTS}
        stroke={INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Everything above the hips, tipped forward together. */}
      <g transform={LEAN}>
      <path d="M44.5 66 h12 v14 h-12 z" fill={SKIN_SHADE} />

      {/* The shirt. */}
      <path
        d="M33 87 Q33 77 50 77 Q67 77 67 87 L69 104 Q50 111 31 104 Z"
        fill={SHIRT}
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Collar. */}
      <path d="M44 78 L50 85 L56 78" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* The federation crest, and the maker's mark opposite it. */}
      <circle cx="58" cy="95" r="4.8" fill={CREST} stroke={GOLD} strokeWidth="1.4" />
      <path d="M58 92.2 L58.9 94.4 L61.2 94.4 L59.4 95.9 L60.1 98.1 L58 96.8 L55.9 98.1 L56.6 95.9 L54.8 94.4 L57.1 94.4 Z" fill={GOLD} />
      <path d="M38 94 Q42 90 46 93" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      {/* The trailing sleeve, over the arm it belongs to. */}
      <path d="M67 87 Q73 89 72 97 L64 98 Q65 90 63 87 Z" fill={SHIRT_SHADE} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M71.6 96 L64.4 97" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />

      {/* Head. */}
      <ellipse cx="31" cy="48" rx="4.6" ry="5.2" fill={SKIN} stroke={INK} strokeWidth="1.8" />
      <ellipse cx="71" cy="48" rx="4.6" ry="5.2" fill={SKIN} stroke={INK} strokeWidth="1.8" />
      <ellipse cx="51" cy="46" rx="20" ry="22.5" fill={SKIN} stroke={INK} strokeWidth="2.4" />

      {/* Beard along the jaw, then the hair over the top of it. */}
      <path
        d="M31.6 50 Q33 68 51 69.5 Q69 68 70.4 50 Q66 64 51 65 Q36 64 31.6 50 Z"
        fill={HAIR}
      />
      <ellipse cx="51" cy="64" rx="6.2" ry="4.2" fill={HAIR} />

      <g fill={HAIR}>
        <circle cx="38" cy="21" r="8.6" />
        <circle cx="51" cy="16" r="9.4" />
        <circle cx="64" cy="21" r="8.6" />
        <circle cx="29.5" cy="34" r="7.4" />
        <circle cx="72.5" cy="34" r="7.4" />
        <path d="M29 50 C25 22 38 12 51 12 C64 12 77 22 73 50 C71 39 68 32 62 30 C56 25 46 25 40 30 C34 32 31 39 29 50 Z" />
      </g>
      <g fill="none" stroke={HAIR_LIT} strokeWidth="1.8" strokeLinecap="round">
        <path d="M36 20 q4 -4 8 -1" />
        <path d="M50 14 q4 -3 8 1" />
        <path d="M31 32 q3 -4 7 -3" />
      </g>

      {/* Brows, then the glasses over them. */}
      <g fill="none" stroke={HAIR} strokeWidth="2.6" strokeLinecap="round">
        <path d="M33 37 q7 -4 14 -1" />
        <path d="M55 36 q7 -3 14 1" />
      </g>
      <circle cx="39" cy="48" r="2.5" fill={INK} />
      <circle cx="61" cy="48" r="2.5" fill={INK} />
      <g fill="#ffffff" fillOpacity="0.2" stroke={FRAME} strokeWidth="2.4">
        <circle cx="40" cy="48" r="9.2" />
        <circle cx="62" cy="48" r="9.2" />
      </g>
      <g fill="none" stroke={FRAME} strokeWidth="2.2" strokeLinecap="round">
        <path d="M49.2 46.5 h3.6" />
        <path d="M31.2 46 L28.5 47" />
        <path d="M70.8 46 L73.5 47" />
      </g>
      <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.5" strokeLinecap="round">
        <path d="M35.5 45 l3.5 -3" />
        <path d="M57.5 45 l3.5 -3" />
      </g>

      <path d="M51 51 q-3.5 6 0.5 7" fill="none" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" />
      <path d="M41 59.5 Q46 56.5 51 59.5 Q56 56.5 61 59.5 Q56 64.5 51 63 Q46 64.5 41 59.5 Z" fill={HAIR} />

      {/* Leading arm, over the torso, with its sleeve over it in turn. */}
      <g className="runner-arm runner-arm--front">
        <path
          d="M33 88 L25 101 L28 114"
          fill="none"
          stroke={SKIN}
          strokeWidth="6.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="115" r="3.7" fill={SKIN} />
      </g>
      <path d="M33 87 Q27 89 28 97 L36 98 Q35 90 37 87 Z" fill={SHIRT} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M28.4 96 L35.6 97" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
