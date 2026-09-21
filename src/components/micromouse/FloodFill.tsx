"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CELL, MAZE_GOLD, generateMaze, type Maze } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES, cellCentre, pathData, startCell } from "@/lib/rules";
import { GoalBlock, MazeCanvas } from "@/components/rules/MazeCanvas";
import { countTurns, floodFill, floodRoute, islandMaze, wallFollow } from "@/lib/micromouse";

/**
 * Flood fill, and the algorithm it replaces.
 *
 * The two halves belong in one diagram because the argument is a comparison.
 * Wall-following is the thing every team tries first, and on this competition's
 * maze it loses outright: told in a sentence that sounds like a footnote, and
 * watched going round the outside for the fourth time it is obviously somebody
 * losing their eight minutes.
 *
 * The maze is picked rather than taken. The site's generator does not promise
 * an island centre, and a demonstration of "a hand on the wall never gets in"
 * on a maze where it does get in teaches the opposite of the rule. See
 * `islandMaze`.
 */

type View = "numbers" | "route" | "hand";

const VIEW_LABELS: Record<View, string> = {
  numbers: "The numbers",
  route: "The route it drives",
  hand: "A hand on the wall",
};

export function FloodFill() {
  const [maze, setMaze] = useState<Maze | null>(null);
  const [isIsland, setIsIsland] = useState(true);
  const [view, setView] = useState<View>("numbers");
  const [step, setStep] = useState(0);

  // Generated on the client, on mount, like every maze on this site: one made
  // during render would differ between the server's markup and the browser's.
  const roll = useCallback(() => {
    const picked = islandMaze(() => generateMaze(RULES.mazeGrid, Math.random, DIAGRAM_BRAID));
    setMaze(picked.maze);
    setIsIsland(picked.isIsland);
    setStep(0);
  }, []);

  useEffect(roll, [roll]);

  const figure = useMemo(() => {
    if (!maze) return null;
    const distances = floodFill(maze);
    const route = floodRoute(maze, distances);
    const hand = wallFollow(maze, "left", 600);
    return {
      distances,
      route,
      routePath: pathData(route),
      turns: countTurns(route),
      hand,
      start: startCell(maze),
    };
  }, [maze]);

  // The hand-follower is walked rather than drawn all at once. Its whole point
  // is that it does not finish, and a finished line on screen says nothing
  // about that.
  useEffect(() => {
    if (view !== "hand" || !figure) return;
    const timer = window.setInterval(() => {
      setStep((current) => (current >= figure.hand.path.length - 1 ? 0 : current + 1));
    }, 90);
    return () => window.clearInterval(timer);
  }, [view, figure]);

  if (!maze || !figure) {
    return <div className="aspect-square w-full max-w-[460px] rounded-xl border border-dashed border-ras-gray/30 dark:border-white/20" />;
  }

  const walked = figure.hand.path.slice(0, step + 1);

  return (
    <div className="not-prose rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-start">
        <div className="mx-auto w-full max-w-[460px]">
          <MazeCanvas maze={maze} label={mazeLabel(view, figure.distances, figure.start)}>
            <GoalBlock maze={maze} className="fill-[#f2a900]/15 stroke-[#f2a900]" />

            {/* Before the numbers, and hollow: filled and drawn last it sat on
                top of the start cell's own distance, which is the one number
                on the diagram a reader goes looking for. */}
            <circle
              cx={cellCentre(figure.start).x}
              cy={cellCentre(figure.start).y}
              r={6}
              fill="none"
              strokeWidth={1.4}
              className="stroke-ras-gray/70 dark:stroke-white/60"
            />

            {view === "numbers" ? <Numbers distances={figure.distances} /> : null}

            {view === "route" ? (
              <path
                d={figure.routePath}
                fill="none"
                className="stroke-ras-crimson dark:stroke-[#ff7b7b]"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {view === "hand" ? (
              <path
                d={pathData(walked)}
                fill="none"
                stroke={MAZE_GOLD}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

          </MazeCanvas>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VIEW_LABELS) as View[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setView(option);
                  setStep(0);
                }}
                aria-pressed={view === option}
                className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors ${
                  view === option
                    ? "bg-ras-purple text-white"
                    : "border border-ras-purple/40 text-ras-purple dark:border-white/30 dark:text-white"
                }`}
              >
                {VIEW_LABELS[option]}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ras-gray dark:text-white/75">
            {view === "numbers" ? (
              <>
                Every cell holds its distance from the centre, counted through the gaps rather than
                across the walls. The centre is 0. Your mouse stands on a number and drives to any
                neighbour holding one less.
              </>
            ) : view === "route" ? (
              <>
                Driving downhill from {figure.distances[figure.start.y]![figure.start.x]} gives the
                shortest route there is: {figure.route.length - 1} cells and {figure.turns} turns.
                Nothing here searched. It only ever compared a number with its neighbours.
              </>
            ) : (
              <>
                Left hand on the wall, {walked.length - 1} cells in.{" "}
                {figure.hand.reachedGoal
                  ? "This maze happens to let it through, which the competition maze will not."
                  : "It traces the outside and comes back to where it started, for eight minutes, forever."}
              </>
            )}
          </p>

          {view === "hand" && !isIsland ? (
            <p className="mt-2 text-xs text-ras-crimson dark:text-[#ff9b9b]">
              This particular random maze is not an island, so the demonstration is weaker than the
              real thing. Press New maze.
            </p>
          ) : null}

          <button
            type="button"
            onClick={roll}
            className="mt-4 min-h-[44px] rounded-full border border-ras-purple/40 px-5 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/30 dark:text-white"
          >
            New maze
          </button>
        </div>
      </div>
    </div>
  );
}

/** The distance in each cell, small enough to read at ten to a side. */
function Numbers({ distances }: { distances: number[][] }) {
  return (
    <g className="fill-ras-gray dark:fill-white/70" fontSize={7} textAnchor="middle">
      {distances.map((row, y) =>
        row.map((value, x) => (
          <text
            key={`${x},${y}`}
            x={x * CELL + CELL / 2}
            y={y * CELL + CELL / 2 + 2.6}
            className={value === 0 ? "fill-ras-crimson font-bold dark:fill-[#ff9b9b]" : undefined}
          >
            {Number.isFinite(value) ? value : "-"}
          </text>
        )),
      )}
    </g>
  );
}

function mazeLabel(view: View, distances: number[][], start: { x: number; y: number }): string {
  const atStart = distances[start.y]![start.x];
  if (view === "numbers") {
    return `A maze with every cell numbered by its distance from the centre. The start cell reads ${atStart}.`;
  }
  if (view === "route") {
    return "The same maze with the downhill route from the start to the centre drawn on it.";
  }
  return "The same maze with the path of a mouse following the left wall, which circles the outside without reaching the centre.";
}
