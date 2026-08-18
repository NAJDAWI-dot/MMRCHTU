/**
 * A micro mouse running the solution line of a small maze.
 *
 * Shared by the splash screen and the route-change loader so both read as the
 * same product as the Pac Mouse game rather than as generic chrome. Pure
 * presentation: no state, no timers. Callers drive it with CSS classes, which
 * keeps the animation on the compositor instead of in React.
 *
 * Geometry: a 7x7 grid of 20px cells. Walls sit on grid lines (multiples of
 * 20) and the path runs through cell centres (10 + 20n), so a wall can never
 * sit on top of the path — only cross it, which the wall list below is
 * hand-checked to avoid.
 */

/** Solution line, from the top-left cell to the centre of the grid. */
const PATH = "M10 10 H50 V50 H10 V110 H70 V70";

/**
 * Interior walls, each verified not to cross PATH. The maze reads as solved
 * rather than being a real generated maze — at this size and duration, legible
 * beats correct.
 */
const WALLS = [
  "M100 20 V60",
  "M100 40 H140",
  "M120 80 V120",
  "M90 80 H130",
  "M30 60 V100",
  "M40 90 H60",
];

interface MazeTrailProps {
  /** Rendered size in px. The viewBox is fixed, so this scales cleanly. */
  size?: number;
  className?: string;
  /**
   * "run" plays once and stops with the trail drawn (splash). "loop" repeats
   * indefinitely (route loader).
   */
  motion?: "run" | "loop";
}

export function MazeTrail({ size = 140, className = "", motion = "run" }: MazeTrailProps) {
  const trailClass = motion === "loop" ? "maze-trail maze-trail--loop" : "maze-trail";
  const mouseClass = motion === "loop" ? "maze-mouse maze-mouse--loop" : "maze-mouse";

  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      {/* Walls sit under the trail so the glow reads as passing over them. */}
      <g stroke="currentColor" strokeOpacity="0.32" strokeWidth="2" strokeLinecap="round">
        <rect x="1" y="1" width="138" height="138" rx="4" />
        {WALLS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Faint full-length path, so the route reads even before the mouse runs it. */}
      <path d={PATH} stroke="currentColor" strokeOpacity="0.12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <path
        className={trailClass}
        d={PATH}
        stroke="var(--splash-accent, #F2A900)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle className={mouseClass} r="4.5" fill="var(--splash-accent, #F2A900)" />
    </svg>
  );
}

/** Exported so the CSS keyframes and the offset-path stay in one place. */
export const MAZE_TRAIL_PATH = PATH;
