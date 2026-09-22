"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CELL, MAZE_GOLD, generateMaze, type Maze } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES, cellCentre, goalCells, pathData, startCell } from "@/lib/rules";
import {
  countTurns,
  floodFill,
  floodRoute,
  islandMaze,
  toggleWall,
  wallFollow,
  wallSegments,
} from "@/lib/micromouse";

/**
 * The maze, with the walls in the reader's hands.
 *
 * Flood fill explained in prose is a paragraph people believe and do not
 * understand. Flood fill with a wall you just knocked down, re-numbering
 * itself and picking a different route while you watch, is the same paragraph
 * arriving as an experiment. Nothing here is a video: every number on screen
 * is computed by the same function the guide tells you to write.
 *
 * It also carries the rulebook's warning about wall-following, and the maze is
 * picked rather than taken for that: the site's generator does not promise an
 * island centre, and demonstrating "a hand on the wall never gets in" on a maze
 * where it does get in teaches the opposite of the rule. See `islandMaze`.
 */

type View = "numbers" | "route" | "hand";

const VIEW_LABELS: Record<View, string> = {
  numbers: "The numbers",
  route: "The route it drives",
  hand: "A hand on the wall",
};

const FLOOD_STEP_MS = 90;

export function MazeLab() {
  const [maze, setMaze] = useState<Maze | null>(null);
  const [isIsland, setIsIsland] = useState(true);
  const [view, setView] = useState<View>("numbers");
  const [handStep, setHandStep] = useState(0);
  const [wave, setWave] = useState<number | null>(null);
  const [edits, setEdits] = useState(0);
  const reducedRef = useRef(false);

  const roll = useCallback(() => {
    const picked = islandMaze(() => generateMaze(RULES.mazeGrid, Math.random, DIAGRAM_BRAID));
    setMaze(picked.maze);
    setIsIsland(picked.isIsland);
    setHandStep(0);
    setWave(null);
    setEdits(0);
  }, []);

  useEffect(roll, [roll]);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const figure = useMemo(() => {
    if (!maze) return null;
    const distances = floodFill(maze);
    const route = floodRoute(maze, distances);
    const start = startCell(maze);
    const reach = distances[start.y]![start.x]!;
    return {
      distances,
      route,
      routePath: pathData(route),
      turns: countTurns(route),
      reachable: Number.isFinite(reach),
      reach,
      hand: wallFollow(maze, "left", 600),
      segments: wallSegments(maze, CELL),
      start,
      goal: goalCells(maze),
      deepest: Math.max(
        ...distances.flat().filter((value) => Number.isFinite(value)),
      ),
    };
  }, [maze]);

  // The wavefront, one ring a tick. This is the algorithm's own order, not an
  // effect laid over it: ring n is every cell exactly n moves from the centre.
  useEffect(() => {
    if (wave === null || !figure) return;
    if (wave > figure.deepest) return;
    const timer = window.setTimeout(() => setWave((current) => (current ?? 0) + 1), FLOOD_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [wave, figure]);

  useEffect(() => {
    if (view !== "hand" || !figure) return;
    const timer = window.setInterval(() => {
      setHandStep((current) => (current >= figure.hand.path.length - 1 ? 0 : current + 1));
    }, 90);
    return () => window.clearInterval(timer);
  }, [view, figure]);

  const flipWall = useCallback(
    (cell: { x: number; y: number }, dir: number) => {
      setMaze((current) => (current ? toggleWall(current, cell, dir) : current));
      setEdits((n) => n + 1);
      setWave(null);
      setHandStep(0);
    },
    [],
  );

  if (!maze || !figure) {
    return (
      <div className="not-prose aspect-square w-full max-w-[460px] rounded-xl border border-dashed border-ras-gray/30 dark:border-white/20" />
    );
  }

  const walked = figure.hand.path.slice(0, handStep + 1);
  const showNumber = (value: number) =>
    view === "numbers" && Number.isFinite(value) && (wave === null || value <= wave);

  return (
    <div className="not-prose rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_262px] sm:items-start">
        <div className="mx-auto w-full max-w-[460px]">
          <svg
            viewBox={maze.viewBox}
            role="img"
            aria-label={label(view, figure.reach, figure.reachable)}
            className="h-auto w-full touch-manipulation"
          >
            {/* The goal, drawn first so walls sit over its edges. */}
            {figure.goal.map((cell) => (
              <rect
                key={`${cell.x},${cell.y}`}
                x={cell.x * CELL}
                y={cell.y * CELL}
                width={CELL}
                height={CELL}
                /* A scale opacity, not an arbitrary one. Tailwind does not
                   generate /18, so the class was dropped and the goal came out
                   as a black square. */
                className="fill-[#f2a900]/20 stroke-[#f2a900]"
                strokeWidth={1.5}
              />
            ))}

            {/* Cells the walls have shut off entirely. Knock a wall down and
                they come back, which is the clearest thing an editor can show
                about what "unreachable" means. */}
            {figure.distances.map((row, y) =>
              row.map((value, x) =>
                Number.isFinite(value) ? null : (
                  <rect
                    key={`u${x},${y}`}
                    x={x * CELL}
                    y={y * CELL}
                    width={CELL}
                    height={CELL}
                    className="fill-ras-crimson/10"
                  />
                ),
              ),
            )}

            <circle
              cx={cellCentre(figure.start).x}
              cy={cellCentre(figure.start).y}
              r={6}
              fill="none"
              strokeWidth={1.4}
              className="stroke-ras-gray/70 dark:stroke-white/60"
            />

            {view === "numbers"
              ? figure.distances.map((row, y) =>
                  row.map((value, x) =>
                    showNumber(value) ? (
                      <text
                        key={`n${x},${y}`}
                        x={x * CELL + CELL / 2}
                        y={y * CELL + CELL / 2 + 2.6}
                        textAnchor="middle"
                        fontSize={7}
                        className={
                          value === 0
                            ? "fill-ras-crimson font-bold dark:fill-[#ff9b9b]"
                            : value === wave
                              ? "fill-[#f2a900] font-bold"
                              : "fill-ras-gray dark:fill-white/70"
                        }
                      >
                        {value}
                      </text>
                    ) : null,
                  ),
                )
              : null}

            {view === "route" && figure.reachable ? (
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

            {/* The walls, drawn from the grid rather than from the maze's own
                merged paths, because merged paths cannot be edited. */}
            <g strokeWidth={2} strokeLinecap="square" className="stroke-ras-purple dark:stroke-white/75">
              {figure.segments
                .filter((segment) => segment.present)
                .map((segment) => (
                  <line
                    key={`w${segment.cell.x},${segment.cell.y},${segment.dir}`}
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                  />
                ))}
            </g>

            {/* Fat invisible targets over every internal edge. A 2px line is
                not something anybody can hit with a finger. */}
            <g>
              {figure.segments
                .filter((segment) => segment.editable)
                .map((segment) => (
                  <line
                    key={`t${segment.cell.x},${segment.cell.y},${segment.dir}`}
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    strokeWidth={7}
                    stroke="transparent"
                    className="cursor-pointer [&:hover]:stroke-[#f2a900]/60"
                    onClick={() => flipWall(segment.cell, segment.dir)}
                  />
                ))}
            </g>
          </svg>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VIEW_LABELS) as View[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setView(option);
                  setHandStep(0);
                  setWave(null);
                }}
                aria-pressed={view === option}
                className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold transition-colors ${
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
                across the walls. The centre is 0, and your mouse drives to any neighbour holding
                one less.{" "}
                <strong className="text-ras-purple dark:text-white">
                  Click any wall to knock it down or build it back
                </strong>
                , and watch the numbers rearrange themselves.
              </>
            ) : view === "route" ? (
              figure.reachable ? (
                <>
                  Downhill from {figure.reach}: {figure.route.length - 1} cells and {figure.turns}{" "}
                  turns, and it is the shortest route there is. Nothing searched. It only ever
                  compared a number with its neighbours. Click a wall and it re-solves.
                </>
              ) : (
                <>You have walled the centre off completely. Nothing can reach it from the start.</>
              )
            ) : (
              <>
                Left hand on the wall, {walked.length - 1} cells in.{" "}
                {figure.hand.reachedGoal
                  ? "This maze lets it through. The competition maze will not."
                  : "It traces the outside and comes back to where it started, for eight minutes, forever."}
              </>
            )}
          </p>

          {view === "hand" && !isIsland ? (
            <p className="mt-2 text-xs text-ras-crimson dark:text-[#ff9b9b]">
              This random maze is not an island, so the demonstration is weaker than the real
              thing. Press New maze.
            </p>
          ) : null}

          {edits > 0 ? (
            <p className="mt-2 text-xs text-ras-gray dark:text-white/55">
              {edits} wall{edits === 1 ? "" : "s"} changed. This is no longer a maze the generator
              would produce.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setView("numbers");
                setWave(reducedRef.current ? figure.deepest : 0);
              }}
              className="min-h-[44px] rounded-full bg-ras-purple px-4 text-sm font-semibold text-white transition-transform active:scale-95"
            >
              Watch it flood
            </button>
            <button
              type="button"
              onClick={roll}
              className="min-h-[44px] rounded-full border border-ras-purple/40 px-4 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/30 dark:text-white"
            >
              New maze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function label(view: View, reach: number, reachable: boolean): string {
  if (view === "numbers") {
    return reachable
      ? `A maze with every cell numbered by its distance from the centre. The start cell reads ${reach}.`
      : "A maze whose centre has been walled off, so no cell can reach it.";
  }
  if (view === "route") {
    return "The same maze with the downhill route from the start to the centre drawn on it.";
  }
  return "The same maze with the path of a mouse following the left wall, which circles the outside without reaching the centre.";
}
