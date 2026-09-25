"use client";

import { useEffect, useMemo, useRef } from "react";
import { MICE, TOP_MOUSE_TURN } from "@/components/day-site/DayMice";
import { floodDistances } from "@/lib/flood";
import { CELL, generateMaze, seededRandom } from "@/lib/maze";

/** Cells per side: the classic micromouse maze is sixteen by sixteen. */
const SIZE = 16;
/** A post's side, in the maze's own units (a cell is 20). */
const POST = 2.8;
/** How far a wall's crimson side shows under its top, like the real maze seen from above and in front. */
const DEPTH = 1.1;
/** The mouse, nose to tail, in maze units. */
const MOUSE = 17;
/** Where the route begins: a little way in, so the mouse is already running at the top of a page. */
const HEAD_START = 0.04;

/**
 * The floor the day site stands on: a real sixteen by sixteen micromouse
 * maze, carved from a fixed seed so the server and every visitor draw the same
 * one, and drawn the way the real board looks: walls with a white top and a
 * crimson side, a post wherever walls can meet, the gold room in the centre.
 *
 * Each cell carries its flood-fill number, its distance in moves from the
 * centre, which is how a micromouse actually works the maze out. And a mouse
 * runs it: as the page scrolls, it follows the shortest route in from its
 * corner, its sensors sweeping ahead and its route drawn in crimson behind it,
 * arriving in the gold room at the bottom of the page. The header's progress
 * line reads the same number.
 *
 * Fixed behind everything and hidden from assistive technology: it is the
 * floor, not content. The maze fades where the reading happens, and so does
 * the mouse, a little less: bold out in the margins, a ghost behind the text,
 * so it never sits over anything that matters. With reduced motion the route
 * is drawn whole and the mouse waits in the centre.
 */
export function DayBackdrop() {
  const maze = useMemo(() => generateMaze(SIZE, seededRandom(1626), 0.12), []);
  const route = maze.routes[0]!;
  const flood = useMemo(() => floodDistances(maze), [maze]);
  const posts = useMemo(() => {
    let d = "";
    for (let row = 0; row <= SIZE; row++) {
      for (let col = 0; col <= SIZE; col++) {
        d += `M${col * CELL - POST / 2} ${row * CELL - POST / 2}h${POST}v${POST}h-${POST}z`;
      }
    }
    return d;
  }, []);

  const routeRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const path = routeRef.current;
    const mouse = mouseRef.current;
    if (!path || !mouse) return;
    const length = path.getTotalLength();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bars = () => document.querySelectorAll<HTMLElement>(".day-progress");

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const read = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bars().forEach((bar) => bar.style.setProperty("--day-progress", String(read)));

      const run = still.matches ? 1 : HEAD_START + read * (1 - HEAD_START);
      path.style.strokeDashoffset = String(1 - run);
      // Where the mouse is, and which way it faces: along the route either side of it.
      const at = Math.min(length, run * length);
      const here = path.getPointAtLength(at);
      const ahead = path.getPointAtLength(Math.min(length, at + 2));
      const behind = path.getPointAtLength(Math.max(0, at - 2));
      const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
      mouse.setAttribute("transform", `translate(${here.x.toFixed(2)} ${here.y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    still.addEventListener?.("change", onScroll);
    // A page that grows after it loads (photos, a refresh) moves the finish.
    const grow = new ResizeObserver(onScroll);
    grow.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      still.removeEventListener?.("change", onScroll);
      grow.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const span = SIZE * CELL;
  const viewBox = `-6 -6 ${span + 12} ${span + 12}`;
  const top = MICE.top;
  const mouseH = (MOUSE * top.height) / top.width;

  return (
    <div className="day-backdrop" aria-hidden="true">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="day-maze">
        {/* Flood fill: every cell's distance from the centre. */}
        <g className="day-maze-flood" textAnchor="middle" fontSize={3.6}>
          {flood.map((distance, index) => (
            <text
              key={index}
              x={(index % SIZE) * CELL + CELL / 2}
              y={Math.floor(index / SIZE) * CELL + CELL / 2 + 1.3}
              className={distance === 0 ? "day-maze-goal" : undefined}
            >
              {distance}
            </text>
          ))}
        </g>
        <path
          ref={routeRef}
          className="day-maze-route"
          d={route.solution}
          pathLength={1}
          fill="none"
          strokeWidth={2.4}
          strokeLinecap="square"
          strokeLinejoin="miter"
          style={{ strokeDashoffset: 1 - HEAD_START }}
        />
        {/* The walls: the crimson side first, then the top over it. */}
        <g className="day-maze-sides" fill="none" strokeWidth={1.1} strokeLinecap="square" transform={`translate(0 ${DEPTH})`}>
          {maze.walls.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <rect x={0} y={0} width={span} height={span} />
        </g>
        <g className="day-maze-walls" fill="none" strokeWidth={1.1} strokeLinecap="square">
          {maze.walls.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <rect x={0} y={0} width={span} height={span} />
        </g>
        <path className="day-maze-post-sides" d={posts} transform={`translate(0 ${DEPTH})`} />
        <path className="day-maze-posts" d={posts} />
      </svg>

      {/* The mouse, on a layer of its own with a gentler fade than the maze's. */}
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="day-maze-runner">
        <g ref={mouseRef} transform={`translate(${route.start.x} ${route.start.y})`}>
          {/* Its sensors: one ahead, one to each side, reading the walls. */}
          <g className="day-maze-sensors" strokeWidth={0.7} strokeLinecap="round">
            <path d="M8 0H22" />
            <path d="M6 -3L15 -11" />
            <path d="M6 3L15 11" />
          </g>
          <image
            href={top.src}
            width={MOUSE}
            height={mouseH}
            x={-MOUSE / 2}
            y={-mouseH / 2}
            transform={`rotate(${TOP_MOUSE_TURN})`}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      </svg>
    </div>
  );
}
