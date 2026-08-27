"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  LOADER_GRID,
  SPLASH_GRID,
  mazeTiming,
  newLoaderMaze,
  newSplashMaze,
  routePacing,
  wallBands,
  type Maze,
  type MazeTiming,
} from "@/lib/maze";

/**
 * Micro mice running a real, freshly generated micromouse maze.
 *
 * Shared by the splash screen and the route-change loader so both read as the
 * same product as the Pac Mouse game rather than as generic chrome.
 *
 * The maze is generated on the client, on mount, rather than on the server or
 * at build time. Both alternatives would hand every visitor the same maze —
 * and generating during render would make the server's markup disagree with
 * the client's, which is a hydration error. Rendering nothing until mounted
 * keeps the two in agreement; the maze then lands a frame later, against a
 * background that is already painted, so there is nothing to see in the gap.
 *
 * Correctness of the geometry lives in `@/lib/maze` and is tested there. This
 * file is only presentation: it owns no timing of its own, and reports the
 * animation's length to its caller rather than assuming anyone knows it.
 */

/** Enough bands to read as a sweep, few enough that each carries real weight. */
const WALL_BANDS = 6;

/**
 * One mouse, not four.
 *
 * At loader size a second line spends most of its lap crossing the first, and
 * two trails moving at once read as a tangle rather than as one thing solving
 * the maze. A single line is legible at 130px in the fraction of a second a
 * page change actually lasts.
 */
const LOOP_MICE = 1;

/** Units per second for the loader's endless lap. Slower than the splash run. */
const LOOP_SPEED = 96;

const GOLD = "#f2a900";
const GOLD_LIGHT = "#ffd97a";
const CYAN = "#9fd8f2";
const CYAN_LIGHT = "#cdeeff";

/** CSS custom properties are not in React's CSSProperties, hence the widening. */
type Vars = CSSProperties & Record<string, string | number>;

interface MazeTrailProps {
  /**
   * Fallback rendered size in px. CSS wins over this, so a caller can hand the
   * SVG a responsive width through `className` instead.
   */
  size?: number;
  className?: string;
  /**
   * "run" plays once and stops with every mouse parked (splash). "loop"
   * repeats indefinitely (route loader).
   */
  motion?: "run" | "loop";
  /**
   * Called once the maze exists, with how it is timed. Those numbers move with
   * the maze that was drawn, so the splash asks rather than assumes — a
   * hard-coded hold would cut a long maze off mid-run.
   */
  onReady?: (timing: MazeTiming) => void;
}

export function MazeTrail({
  size = 140,
  className = "",
  motion = "run",
  onReady,
}: MazeTrailProps) {
  const [maze, setMaze] = useState<Maze | null>(null);

  // Held in a ref so an inline callback from the parent cannot re-trigger
  // generation and swap the maze mid-animation.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (motion === "loop") {
      // The loader laps at its own pace until the page is ready, so it has no
      // total to report and nothing to synchronise against.
      setMaze(newLoaderMaze());
      return;
    }
    const next = newSplashMaze();
    setMaze(next);
    onReadyRef.current?.(mazeTiming(next));
  }, [motion]);

  const grid = motion === "loop" ? LOADER_GRID : SPLASH_GRID;
  const span = grid * 20;

  // Reserve the space before the maze exists, so the layout does not shift
  // under the lockup when it arrives.
  if (!maze) {
    return (
      <svg
        viewBox={`0 0 ${span} ${span}`}
        width={size}
        height={size}
        className={className}
        role="presentation"
        aria-hidden="true"
        fill="none"
      />
    );
  }

  return (
    <svg
      viewBox={maze.viewBox}
      width={size}
      height={size}
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      {motion === "loop" ? <LoopMaze maze={maze} /> : <RunMaze maze={maze} />}
    </svg>
  );
}

/** The splash: four mice from four corners, converging on the centre together. */
function RunMaze({ maze }: { maze: Maze }) {
  const timing = mazeTiming(maze);
  const bands = wallBands(maze, WALL_BANDS);

  const vars = (index: number): Vars => {
    const route = maze.routes[index]!;
    const { durationS, delayS } = routePacing(route, maze, timing);
    return {
      "--trail-len": route.pathLength,
      "--route": `path("${route.solution}")`,
      "--run-dur": `${durationS.toFixed(3)}s`,
      "--run-delay": `${delayS.toFixed(3)}s`,
    };
  };

  // Painted back to front, so the gold lead stays on top wherever routes share
  // a corridor — which, near the goal, is most of them.
  const order = maze.routes.map((_, i) => i).reverse();

  return (
    <g
      style={
        {
          "--goal-at": `${timing.goalS.toFixed(2)}s`,
        } as Vars
      }
    >
      {bands.map((band, b) => (
        <g
          key={b}
          className={`maze-band maze-band-${b}`}
          stroke="currentColor"
          strokeOpacity="0.26"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          {band.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      ))}

      <rect
        className="maze-goal"
        x={maze.goal.x + 3}
        y={maze.goal.y + 3}
        width={maze.goal.size - 6}
        height={maze.goal.size - 6}
        rx="4"
        fill={GOLD}
        fillOpacity="0.16"
        stroke={GOLD}
        strokeWidth="2"
      />
      <rect
        className="maze-goal-ring"
        x={maze.goal.x + 3}
        y={maze.goal.y + 3}
        width={maze.goal.size - 6}
        height={maze.goal.size - 6}
        rx="4"
        fill="none"
        stroke={GOLD}
        strokeWidth="2"
      />

      {/* Where each mouse is about to set off from. */}
      {maze.routes.map((route, i) => (
        <circle
          key={`pip-${i}`}
          className="maze-pip"
          cx={route.start.x}
          cy={route.start.y}
          r={i === 0 ? 3.4 : 2.6}
          fill={i === 0 ? GOLD : CYAN}
          fillOpacity={i === 0 ? 0.85 : 0.6}
          style={{ "--pip-at": `${(timing.leadInS - 0.1).toFixed(2)}s` } as Vars}
        />
      ))}

      {order.map((i) => {
        const route = maze.routes[i]!;
        const lead = i === 0;
        return (
          <g key={`trail-${i}`}>
            {lead && (
              <path
                className="maze-trail"
                d={route.solution}
                stroke={GOLD}
                strokeOpacity="0.2"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={vars(i)}
              />
            )}
            <path
              className="maze-trail"
              d={route.solution}
              stroke={lead ? GOLD : CYAN}
              strokeOpacity={lead ? 1 : 0.85}
              strokeWidth={lead ? 3 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={vars(i)}
            />
          </g>
        );
      })}

      {order.map((i) => {
        const lead = i === 0;
        return (
          <g key={`mouse-${i}`} className="maze-mouse" style={vars(i)}>
            {lead && <circle r="8.5" fill={GOLD} fillOpacity="0.2" />}
            <rect
              x={lead ? -4.6 : -3.6}
              y={lead ? -3.4 : -2.7}
              width={lead ? 9.2 : 7.2}
              height={lead ? 6.8 : 5.4}
              rx={lead ? 2.1 : 1.7}
              fill={lead ? GOLD_LIGHT : CYAN_LIGHT}
            />
            {lead && <circle cx="2.6" cy="0" r="1.5" fill="#3f1546" />}
          </g>
        );
      })}
    </g>
  );
}

/** The route loader: one mouse lapping a small maze until the page is ready. */
function LoopMaze({ maze }: { maze: Maze }) {
  const routes = maze.routes.slice(0, LOOP_MICE);

  const vars = (index: number): Vars => {
    const route = routes[index]!;
    // A gap the full length of the path means only ever one dash on screen.
    const segment = Math.round(route.pathLength * 0.34);
    return {
      // Both ends of the dash animation must carry units, or Chrome gives up
      // interpolating between a bare number and a length and snaps to the end.
      "--loop-len": `${route.pathLength}px`,
      "--loop-seg": `${segment}px`,
      "--loop-seg-end": `${segment - route.pathLength}px`,
      "--route": `path("${route.solution}")`,
      "--lap": `${(route.pathLength / LOOP_SPEED).toFixed(2)}s`,
    };
  };

  const order = routes.map((_, i) => i).reverse();

  return (
    <g>
      <g stroke="currentColor" strokeOpacity="0.24" strokeWidth="2.6" strokeLinecap="round">
        {maze.walls.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <rect
        x={maze.goal.x + 3}
        y={maze.goal.y + 3}
        width={maze.goal.size - 6}
        height={maze.goal.size - 6}
        rx="4"
        fill={GOLD}
        fillOpacity="0.14"
        stroke={GOLD}
        strokeWidth="1.8"
        strokeOpacity="0.55"
      />

      {/* Faint full-length routes, so the maze reads as solved between laps. */}
      {routes.map((route, i) => (
        <path
          key={`ghost-${i}`}
          d={route.solution}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {order.map((i) => (
        <path
          key={`loop-trail-${i}`}
          className="maze-loop-trail"
          d={routes[i]!.solution}
          stroke={i === 0 ? GOLD : CYAN}
          strokeOpacity={i === 0 ? 1 : 0.85}
          strokeWidth={i === 0 ? 3.4 : 2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={vars(i)}
        />
      ))}

      {order.map((i) => (
        <g key={`loop-mouse-${i}`} className="maze-loop-mouse" style={vars(i)}>
          {i === 0 && <circle r="7" fill={GOLD} fillOpacity="0.2" />}
          <rect
            x={i === 0 ? -4.4 : -3.5}
            y={i === 0 ? -3.2 : -2.6}
            width={i === 0 ? 8.8 : 7}
            height={i === 0 ? 6.4 : 5.2}
            rx="2"
            fill={i === 0 ? GOLD_LIGHT : CYAN_LIGHT}
          />
        </g>
      ))}
    </g>
  );
}
