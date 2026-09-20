import { CELL, MAZE_GOLD, type Maze } from "@/lib/maze";

/**
 * A crest, drawn.
 *
 * Pulled out of `TeamCrest` when the open day page put a wall of them on
 * screen: the registration form draws one crest beside a text box, and the
 * wall draws a hundred and twenty at thumbnail size in a server component.
 * Two copies of this SVG would have drifted within a week, and the crest is
 * supposed to be the one thing about a team that looks the same everywhere it
 * appears.
 *
 * No "use client" on purpose, so both callers can have it: the form pulls it
 * into the browser bundle, the wall renders it to markup on the server and
 * ships no JavaScript for it at all.
 */
export function CrestMaze({
  maze,
  size,
  label,
  strokeWidth = 2.4,
  className = "",
}: {
  maze: Maze;
  size: number;
  /** Null for a crest that is decorative, beside a name that already says it. */
  label: string | null;
  /**
   * In viewBox units, so it thickens with the drawing rather than with the
   * rendered size. The wall of crests asks for more: at 54 pixels the form's
   * weight comes out around one device pixel and the whole grid reads as grey.
   */
  strokeWidth?: number;
  className?: string;
}) {
  const span = maze.size * CELL;

  return (
    <svg
      viewBox={maze.viewBox}
      width={size}
      height={size}
      className={className}
      {...(label === null ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      {/* The goal block first, so the walls draw over its edges. */}
      <rect
        x={maze.goal.x + 2}
        y={maze.goal.y + 2}
        width={maze.goal.size - 4}
        height={maze.goal.size - 4}
        rx={3}
        fill={MAZE_GOLD}
        fillOpacity={0.2}
        stroke={MAZE_GOLD}
        strokeWidth={2}
      />
      {/* The way in, kept faint: the crest is a picture, not a puzzle to be
          solved at 84 pixels. */}
      {maze.routes[0] && (
        <path
          d={maze.routes[0].solution}
          fill="none"
          strokeWidth={strokeWidth + 0.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={MAZE_GOLD}
          strokeOpacity={0.45}
        />
      )}
      {maze.walls.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-ras-purple dark:stroke-white/85"
        />
      ))}
      {/* Encloses the crest, so it reads as a badge rather than as a fragment
          of a larger maze that has been cropped. */}
      <rect
        x={0}
        y={0}
        width={span}
        height={span}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-ras-purple dark:stroke-white/85"
      />
    </svg>
  );
}
