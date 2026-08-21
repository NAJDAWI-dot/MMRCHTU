import type { ReactNode } from "react";
import type { Cell, Maze } from "@/lib/maze";
import { CELL } from "@/lib/maze";

/**
 * The walls, drawn. Shared by every diagram on the rules page so they cannot
 * end up looking like three different mazes.
 *
 * Overlays are passed in rather than configured: `beneath` lands under the
 * walls (cell tints, which walls should sit on top of) and `children` over them
 * (routes and markers, which should not be cut in half).
 */
export function MazeCanvas({
  maze,
  label,
  beneath,
  children,
  className = "",
}: {
  maze: Maze;
  /** What the diagram shows, for anyone who cannot see it. */
  label: string;
  beneath?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox={maze.viewBox}
      role="img"
      aria-label={label}
      className={`h-auto w-full ${className}`}
    >
      {beneath}
      <g
        className="stroke-ras-purple dark:stroke-white/75"
        strokeWidth={2}
        strokeLinecap="square"
        fill="none"
      >
        {maze.walls.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {children}
    </svg>
  );
}

/**
 * Walls sit on cell boundaries, so a tint drawn to full width would meet its
 * neighbour's underneath the wall. Two discovered cells side by side would read
 * as one shape, and the count the caption gives would not match what is on
 * screen. Insetting each one keeps them countable.
 */
const TINT_INSET = 1.5;

/** A tinted cell. Used to show what a run has discovered. */
export function CellTint({ cell, className }: { cell: Cell; className: string }) {
  return (
    <rect
      x={cell.x * CELL + TINT_INSET}
      y={cell.y * CELL + TINT_INSET}
      width={CELL - TINT_INSET * 2}
      height={CELL - TINT_INSET * 2}
      rx={2}
      className={className}
    />
  );
}

/** The 2x2 goal room as one block, since its interior walls are removed. */
export function GoalBlock({ maze, className }: { maze: Maze; className: string }) {
  return (
    <rect
      x={maze.goal.x}
      y={maze.goal.y}
      width={maze.goal.size}
      height={maze.goal.size}
      rx={3}
      className={className}
    />
  );
}
