"use client";

import { useRef } from "react";
import { BOARD_VIEWBOX, BoardMouse, BoardRoute, BoardWalls, FloodNumbers, useBoard, useScrollRun } from "@/components/day-site/MazeBoard";

/** The header's progress line reads the same number the mouse runs on. */
function setProgress(read: number) {
  document.querySelectorAll<HTMLElement>(".day-progress").forEach((bar) => bar.style.setProperty("--day-progress", String(read)));
}

/**
 * The floor the day site stands on: the board from MazeBoard, fixed behind
 * everything.
 *
 * Each cell carries its flood-fill number, its distance in moves from the
 * centre, which is how a micromouse actually works the maze out. And a mouse
 * runs it: as the page scrolls, it follows the shortest route in from its
 * corner, its sensors sweeping ahead and its route drawn in crimson behind it,
 * arriving in the gold room at the bottom of the page. The header's progress
 * line reads the same number.
 *
 * Hidden from assistive technology: it is the floor, not content. The maze
 * fades where the reading happens, and so does the mouse, a little less: bold
 * out in the margins, a ghost behind the text, so it never sits over anything
 * that matters. With reduced motion the route is drawn whole and the mouse
 * waits in the centre.
 */
export function DayBackdrop() {
  const { maze, route, flood, posts } = useBoard();
  const routeRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef<SVGGElement>(null);
  useScrollRun(routeRef, mouseRef, setProgress);

  return (
    <div className="day-backdrop" aria-hidden="true">
      <svg viewBox={BOARD_VIEWBOX} preserveAspectRatio="xMidYMid slice" className="day-maze">
        <FloodNumbers flood={flood} className="day-maze-flood" goalClassName="day-maze-goal" />
        <BoardRoute ref={routeRef} d={route.solution} className="day-maze-route" />
        <BoardWalls walls={maze.walls} posts={posts} prefix="day-maze" />
      </svg>

      {/* The mouse, on a layer of its own with a gentler fade than the maze's. */}
      <svg viewBox={BOARD_VIEWBOX} preserveAspectRatio="xMidYMid slice" className="day-maze-runner">
        <BoardMouse ref={mouseRef} start={route.start} sensorsClassName="day-maze-sensors" />
      </svg>
    </div>
  );
}
