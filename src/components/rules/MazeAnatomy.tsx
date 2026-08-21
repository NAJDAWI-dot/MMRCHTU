"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CELL, generateMaze, type Maze } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES, cellCentre, pathData, shortestPath, startCell } from "@/lib/rules";
import { CellTint, GoalBlock, MazeCanvas } from "@/components/rules/MazeCanvas";
import { Figure, Legend, Stat } from "@/components/rules/Figure";

/**
 * The maze section of the rulebook, drawn instead of described.
 *
 * "The start cell is in a corner; the goal is a 2x2 block at the maze center"
 * is a sentence people read past. A real maze, re-rollable, makes the shape of
 * the thing obvious in a glance — and re-rolling is the point: entrants should
 * leave knowing the layout changes but the geography does not.
 *
 * Generated in an effect rather than during render. The maze is random, so
 * producing one on the server would disagree with the one the browser makes and
 * React would throw a hydration mismatch.
 */
export function MazeAnatomy() {
  const [maze, setMaze] = useState<Maze | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  // Bumped on every new maze, including the first, so the entrance animation
  // below has a `key` that actually changes — the maze object's own identity
  // changing isn't enough to tell a keyed element to remount.
  const [generation, setGeneration] = useState(0);

  const roll = () => {
    setMaze(generateMaze(RULES.mazeGrid, Math.random, DIAGRAM_BRAID));
    setGeneration((g) => g + 1);
  };

  useEffect(roll, []);

  const route = maze ? shortestPath(maze, startCell(maze)) : [];

  return (
    <Figure
      id="the-maze"
      title="The competition maze"
      controls={
        <>
          <Button
            variant="ghost"
            className="min-h-[44px] transition-transform active:scale-95"
            aria-pressed={showRoute}
            onClick={() => setShowRoute((v) => !v)}
            disabled={!maze}
          >
            {showRoute ? "Hide route" : "Show route"}
          </Button>
          <Button
            variant="ghost"
            className="min-h-[44px] transition-transform active:scale-95"
            onClick={roll}
            disabled={!maze}
          >
            New maze
          </Button>
        </>
      }
      caption={
        <>
          Every maze is different, but the geography never is: {RULES.mazeGrid}×{RULES.mazeGrid}{" "}
          cells, one start corner, and the goal room dead centre. The competition maze is not
          published beforehand — this is a fresh one each time you press the button.
        </>
      }
    >
      {maze ? (
        <>
          {/* Keyed on the generation counter so a fresh maze plays the same
              entrance the first one did, rather than snapping into place. */}
          <div key={generation} className="figure-in">
            <MazeCanvas
              maze={maze}
              label={`A ${RULES.mazeGrid} by ${RULES.mazeGrid} micromouse maze, with the start cell in the bottom-left corner and the goal room at the centre.`}
              beneath={
                <>
                  <GoalBlock maze={maze} className="fill-ras-purple/20 dark:fill-white/25" />
                  <CellTint
                    cell={startCell(maze)}
                    className="fill-ras-crimson/70 dark:fill-rose-400/80"
                  />
                </>
              }
            >
              {/* Always mounted, opacity-toggled, so the reveal is a transition
                  rather than a pop. A conditionally-rendered element cannot
                  transition its own arrival. */}
              <path
                d={pathData(route)}
                fill="none"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`stroke-ras-crimson transition-opacity duration-300 dark:stroke-rose-400 ${
                  showRoute ? "opacity-100" : "opacity-0"
                }`}
              />
              {/* A soft pulse radiating from the start cell — the one thing on
                  the diagram that moves before anyone touches a control. */}
              <circle
                cx={cellCentre(startCell(maze)).x}
                cy={cellCentre(startCell(maze)).y}
                r={CELL / 5}
                className="marker-pulse fill-none stroke-ras-crimson dark:stroke-rose-400"
                strokeWidth={2}
              />
              {/* Drawn last so the solid marker sits above the pulse and the route. */}
              <circle
                cx={cellCentre(startCell(maze)).x}
                cy={cellCentre(startCell(maze)).y}
                r={CELL / 5}
                className="fill-white stroke-ras-crimson dark:stroke-rose-400"
                strokeWidth={2}
              />
            </MazeCanvas>
          </div>

          <Legend
            items={[
              {
                kind: "dot",
                className: "fill-white stroke-ras-crimson dark:stroke-rose-400",
                label: "Start cell",
              },
              {
                kind: "cell",
                className: "fill-ras-purple/20 dark:fill-white/25",
                label: "Goal room",
              },
              ...(showRoute
                ? ([
                    {
                      kind: "line" as const,
                      className: "stroke-ras-crimson dark:stroke-rose-400",
                      label: "Shortest route to the goal",
                    },
                  ] as const)
                : []),
            ]}
          />

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Grid" value={`${RULES.mazeGrid}×${RULES.mazeGrid}`} />
            <Stat label="Cell" value={`${RULES.cellSizeCm}cm`} />
            <Stat label="Walls" value={`${RULES.wallHeightCm}cm`} />
            <Stat label="Shortest route" value={`${route.length} cells`} />
          </dl>
        </>
      ) : (
        // Holds the exact space the maze will take, so the page does not jump
        // when it arrives.
        <div
          className="aspect-square w-full rounded-md bg-ras-purple/5 dark:bg-white/5"
          aria-hidden="true"
        />
      )}
    </Figure>
  );
}
