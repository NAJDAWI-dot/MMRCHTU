"use client";

import { useCallback, useEffect, useState } from "react";
import { CELL, DIRS, generateMaze, type Cell, type Maze } from "@/lib/maze";
import { cellCentre, goalCells } from "@/lib/rules";

/**
 * A small maze to steer out of, for the 404 page.
 *
 * A dead end is the one page where a visitor has nothing to do, so it is the
 * cheapest place on the site to put something worth staying for — and the
 * generator is already here. Small on purpose: this is a diversion of a few
 * seconds, not the Pac Mouse game.
 *
 * Generated in an effect, like every other maze on the site, because a random
 * one produced on the server would not match the one the browser draws.
 */

const GRID = 8;

export function LostMaze() {
  const [maze, setMaze] = useState<Maze | null>(null);
  const [at, setAt] = useState<Cell>({ x: 0, y: GRID - 1 });
  const [steps, setSteps] = useState(0);
  const [escaped, setEscaped] = useState(false);

  const reset = useCallback(() => {
    // Lightly braided so there is more than one way through — a single
    // corridor is a corridor, not a maze.
    setMaze(generateMaze(GRID, Math.random, 0.1));
    setAt({ x: 0, y: GRID - 1 });
    setSteps(0);
    setEscaped(false);
  }, []);

  useEffect(reset, [reset]);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (!maze || escaped) return;
      setAt((current) => {
        const dir = DIRS.find((d) => d.dx === dx && d.dy === dy);
        if (!dir) return current;

        const walls = maze.cells[current.y * maze.size + current.x]!;
        if (walls[dir.wall]) return current; // a wall is a wall

        const next = { x: current.x + dx, y: current.y + dy };
        if (next.x < 0 || next.x >= maze.size || next.y < 0 || next.y >= maze.size) return current;

        setSteps((n) => n + 1);
        if (goalCells(maze).some((g) => g.x === next.x && g.y === next.y)) setEscaped(true);
        return next;
      });
    },
    [maze, escaped],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = {
        arrowup: [0, -1], w: [0, -1],
        arrowdown: [0, 1], s: [0, 1],
        arrowleft: [-1, 0], a: [-1, 0],
        arrowright: [1, 0], d: [1, 0],
      };
      const key = event.key.toLowerCase();
      const delta = moves[key];
      if (!delta) return;
      // Otherwise the arrow keys scroll the page out from under the maze.
      event.preventDefault();
      move(delta[0], delta[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  if (!maze) {
    // Reserves the same square so the page does not jump when it arrives.
    return <div className="mx-auto aspect-square w-full max-w-[260px]" aria-hidden="true" />;
  }

  const me = cellCentre(at);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={maze.viewBox}
        role="img"
        aria-label={
          escaped
            ? "A small maze, solved."
            : "A small maze. Steer the mouse to the centre with the arrow keys or the buttons below."
        }
        className="h-auto w-full max-w-[260px]"
      >
        <rect
          x={maze.goal.x}
          y={maze.goal.y}
          width={maze.goal.size}
          height={maze.goal.size}
          rx={3}
          className={escaped ? "fill-ras-crimson/40" : "fill-ras-purple/20 dark:fill-white/25"}
        />
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
        <circle
          cx={me.x}
          cy={me.y}
          r={CELL / 4}
          className="fill-ras-crimson transition-all duration-100 motion-reduce:transition-none dark:fill-rose-400"
        />
      </svg>

      <p className="mt-3 text-sm text-ras-gray dark:text-white/70" aria-live="polite">
        {escaped
          ? `Out in ${steps} step${steps === 1 ? "" : "s"}. Better than most.`
          : `${steps} step${steps === 1 ? "" : "s"}`}
      </p>

      {/* Touch controls. The keyboard covers everything else. */}
      <div className="mt-3 grid grid-cols-3 gap-1 [@media(hover:hover)]:hidden">
        <span />
        <PadButton label="Up" onPress={() => move(0, -1)}>↑</PadButton>
        <span />
        <PadButton label="Left" onPress={() => move(-1, 0)}>←</PadButton>
        <PadButton label="Down" onPress={() => move(0, 1)}>↓</PadButton>
        <PadButton label="Right" onPress={() => move(1, 0)}>→</PadButton>
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-[44px] rounded-md px-3 text-sm font-semibold text-accent transition-colors hover:underline"
      >
        {escaped ? "Another one" : "New maze"}
      </button>
    </div>
  );
}

function PadButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="h-11 w-11 rounded-md border border-ras-purple/40 text-lg text-ras-purple transition-transform active:scale-90 motion-reduce:active:scale-100 dark:border-white/30 dark:text-white"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
