"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { generateMaze, type Maze } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES, compareRuns, pathData } from "@/lib/rules";
import { CellTint, GoalBlock, MazeCanvas } from "@/components/rules/MazeCanvas";
import { Figure, Legend, Stat } from "@/components/rules/Figure";

/**
 * Why a speed run may only use cells found earlier, shown rather than stated.
 *
 * This is the rule entrants misread most often, and the misreading is always
 * the same: that the fastest route through the maze is the one they will get.
 * It is not — they get the fastest route through the part of the maze they
 * bothered to explore, and the gap between those two is a number this figure
 * puts on screen.
 *
 * The search run is modelled as a depth-first walk (see `searchRun`), which is
 * roughly what a first attempt looks like before anyone implements flood fill.
 */
export function RunComparison() {
  const [maze, setMaze] = useState<Maze | null>(null);
  const [view, setView] = useState<"search" | "speed">("search");

  useEffect(() => setMaze(generateMaze(RULES.mazeGrid, Math.random, DIAGRAM_BRAID)), []);

  const runs = useMemo(() => (maze ? compareRuns(maze) : null), [maze]);
  const totalCells = RULES.mazeGrid * RULES.mazeGrid;

  return (
    <Figure
      id="runs"
      title="A search run, then a speed run"
      controls={
        <>
          <div className="flex rounded-md border border-ras-purple/40 p-0.5 dark:border-white/30">
            {(["search", "speed"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={`min-h-[44px] rounded px-3 text-sm font-semibold transition-colors ${
                  view === mode
                    ? "bg-ras-purple text-white"
                    : "text-ras-purple hover:bg-ras-purple/10 dark:text-white dark:hover:bg-white/10"
                }`}
              >
                {mode === "search" ? "Search run" : "Speed run"}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => setMaze(generateMaze(RULES.mazeGrid, Math.random, DIAGRAM_BRAID))}
            disabled={!maze}
          >
            New maze
          </Button>
        </>
      }
      caption={
        view === "search" ? (
          <>
            The first run explores. It wanders, doubles back, and is not timed against the
            leaderboard — but every cell it steps on is a cell the next run is allowed to use.
          </>
        ) : (
          <>
            The speed run takes the best route through <strong>what the search found</strong> (in
            crimson), not the best route through the maze (dashed). Cells the search skipped are
            simply not available, however obvious the shortcut looks from the outside.
          </>
        )
      }
    >
      {maze && runs ? (
        <>
          <MazeCanvas
            maze={maze}
            label={
              view === "search"
                ? `The same maze with ${runs.search.visited.length} of ${totalCells} cells shaded, showing how much of it an exploring run touched.`
                : `The same maze showing the speed run through explored cells, against the shortest route the maze allows.`
            }
            beneath={
              <>
                <GoalBlock maze={maze} className="fill-ras-purple/20 dark:fill-white/25" />
                {runs.search.visited.map((cell) => (
                  <CellTint
                    key={`${cell.x},${cell.y}`}
                    cell={cell}
                    className={
                      view === "search"
                        ? "fill-ras-crimson/25 dark:fill-rose-400/30"
                        : "fill-ras-crimson/15 dark:fill-rose-400/20"
                    }
                  />
                ))}
              </>
            }
          >
            {view === "speed" ? (
              <>
                {/*
                  The ideal route is drawn twice. Underneath is a casing in the
                  figure's own background colour, which separates the line from
                  the walls it runs beside: without it the dashes are the same
                  weight and nearly the same colour as the maze itself, and the
                  comparison this whole figure exists to make is invisible.

                  It runs down open corridors, never across a standing wall, so
                  the casing cannot rub one out.
                */}
                <path
                  d={pathData(runs.optimal)}
                  fill="none"
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-[var(--color-surface)]"
                />
                <path
                  d={pathData(runs.optimal)}
                  fill="none"
                  strokeWidth={3}
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                  className="stroke-ras-gray dark:stroke-white/80"
                />
                {/* Last, so the run the team actually gets sits on top. */}
                <path
                  d={pathData(runs.speed)}
                  fill="none"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-ras-crimson dark:stroke-rose-400"
                />
              </>
            ) : null}
          </MazeCanvas>

          <Legend
            items={
              view === "search"
                ? [
                    {
                      kind: "cell",
                      className: "fill-ras-crimson/25 dark:fill-rose-400/30",
                      label: "Cells the search found",
                    },
                    {
                      kind: "cell",
                      className: "fill-ras-purple/20 dark:fill-white/25",
                      label: "Goal room",
                    },
                  ]
                : [
                    {
                      kind: "line",
                      className: "stroke-ras-crimson dark:stroke-rose-400",
                      label: "The speed run you get",
                    },
                    {
                      kind: "dashed",
                      className: "stroke-ras-gray dark:stroke-white/80",
                      label: "Best possible route",
                    },
                    {
                      kind: "cell",
                      className: "fill-ras-crimson/15 dark:fill-rose-400/20",
                      label: "Cells the search found",
                    },
                  ]
            }
          />

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Cells found" value={`${runs.search.visited.length}/${totalCells}`} />
            <Stat label="Moves to find it" value={runs.search.moves} />
            <Stat label="Speed run" value={`${runs.speed.length} cells`} />
            <Stat
              label="Cost of skipping"
              value={runs.cellsLost ? `+${runs.cellsLost}` : "none"}
              tone={runs.cellsLost ? "bad" : "good"}
            />
          </dl>
        </>
      ) : (
        <div
          className="aspect-square w-full rounded-md bg-ras-purple/5 dark:bg-white/5"
          aria-hidden="true"
        />
      )}
    </Figure>
  );
}
