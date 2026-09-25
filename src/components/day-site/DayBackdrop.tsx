"use client";

import { useEffect, useMemo } from "react";
import { CELL, generateMaze, seededRandom } from "@/lib/maze";

/** Cells per side: the classic micromouse maze is sixteen by sixteen. */
const SIZE = 16;
/** A post's side, in the maze's own units (a cell is 20). */
const POST = 2.6;

/**
 * The floor the day site stands on: a real sixteen by sixteen maze, carved
 * from a fixed seed so the server and every visitor draw the same walls, with
 * a post at every point where walls can meet. The crimson route of a mouse
 * draws itself towards the centre as the page is scrolled, and the header's
 * progress line follows the same number.
 *
 * Fixed behind everything and hidden from assistive technology: it is the
 * floor, not content. With reduced motion the route is simply drawn.
 */
export function DayBackdrop() {
  const maze = useMemo(() => generateMaze(SIZE, seededRandom(1626), 0.12), []);
  const route = maze.routes[0]!;
  const posts = useMemo(() => {
    let d = "";
    for (let row = 0; row <= SIZE; row++) {
      for (let col = 0; col <= SIZE; col++) {
        d += `M${col * CELL - POST / 2} ${row * CELL - POST / 2}h${POST}v${POST}h-${POST}z`;
      }
    }
    return d;
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty("--day-progress", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const span = SIZE * CELL;
  return (
    <div className="day-backdrop" aria-hidden="true">
      <svg viewBox={`-6 -6 ${span + 12} ${span + 12}`} preserveAspectRatio="xMidYMid slice">
        <path className="day-maze-route" d={route.solution} pathLength={1} fill="none" strokeWidth={2.2} strokeLinecap="square" strokeLinejoin="miter" />
        <g className="day-maze-walls" fill="none" strokeWidth={1.1} strokeLinecap="square">
          {maze.walls.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <rect x={0} y={0} width={span} height={span} />
        </g>
        <path className="day-maze-posts" d={posts} />
      </svg>
    </div>
  );
}
