"use client";

import { forwardRef, useEffect, useMemo, type RefObject } from "react";
import { MICE, TOP_MOUSE_TURN } from "@/components/day-site/DayMice";
import { floodDistances } from "@/lib/flood";
import { CELL, generateMaze, seededRandom } from "@/lib/maze";

/**
 * The board the day site stands on, in pieces, so the day site's floor
 * (DayBackdrop) and the main site's week of being taken over by it
 * (InfectionLayer) draw the very same maze.
 *
 * A real sixteen by sixteen micromouse maze, carved from a fixed seed so the
 * server and every visitor draw the same one, drawn the way the real board
 * looks: walls with a light top and a crimson side, a post wherever walls can
 * meet, the gold room in the centre, and every cell's flood-fill number.
 */

/** Cells per side: the classic micromouse maze is sixteen by sixteen. */
export const BOARD_SIZE = 16;
/** A post's side, in the maze's own units (a cell is 20). */
const POST = 2.8;
/** How far a wall's crimson side shows under its top, like the real maze seen from above and in front. */
const DEPTH = 1.1;
/** The mouse, nose to tail, in maze units. */
const MOUSE = 17;
/** Where the route begins: a little way in, so the mouse is already running at the top of a page. */
export const HEAD_START = 0.04;

export const BOARD_SPAN = BOARD_SIZE * CELL;
export const BOARD_VIEWBOX = `-6 -6 ${BOARD_SPAN + 12} ${BOARD_SPAN + 12}`;

export function useBoard() {
  const maze = useMemo(() => generateMaze(BOARD_SIZE, seededRandom(1626), 0.12), []);
  const flood = useMemo(() => floodDistances(maze), [maze]);
  const posts = useMemo(() => {
    let d = "";
    for (let row = 0; row <= BOARD_SIZE; row++) {
      for (let col = 0; col <= BOARD_SIZE; col++) {
        d += `M${col * CELL - POST / 2} ${row * CELL - POST / 2}h${POST}v${POST}h-${POST}z`;
      }
    }
    return d;
  }, []);
  return { maze, route: maze.routes[0]!, flood, posts };
}

/** Every cell's distance from the centre, the way a micromouse works the maze out. */
export function FloodNumbers({ flood, className, goalClassName, show }: { flood: number[]; className: string; goalClassName: string; show?: (distance: number) => boolean }) {
  return (
    <g className={className} textAnchor="middle" fontSize={3.6}>
      {flood.map((distance, index) =>
        show && !show(distance) ? null : (
          <text
            key={index}
            x={(index % BOARD_SIZE) * CELL + CELL / 2}
            y={Math.floor(index / BOARD_SIZE) * CELL + CELL / 2 + 1.3}
            className={distance === 0 ? goalClassName : undefined}
          >
            {distance}
          </text>
        ),
      )}
    </g>
  );
}

/** The walls, the crimson side first and then the top over it, and the posts. `prefix` names the classes. */
export function BoardWalls({ walls, posts, prefix }: { walls: string[]; posts: string; prefix: string }) {
  return (
    <>
      <g className={`${prefix}-sides`} fill="none" strokeWidth={1.1} strokeLinecap="square" transform={`translate(0 ${DEPTH})`}>
        {walls.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <rect x={0} y={0} width={BOARD_SPAN} height={BOARD_SPAN} />
      </g>
      <g className={`${prefix}-walls`} fill="none" strokeWidth={1.1} strokeLinecap="square">
        {walls.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <rect x={0} y={0} width={BOARD_SPAN} height={BOARD_SPAN} />
      </g>
      <path className={`${prefix}-post-sides`} d={posts} transform={`translate(0 ${DEPTH})`} />
      <path className={`${prefix}-posts`} d={posts} />
    </>
  );
}

/** The route the mouse has run, drawn in behind it. */
export const BoardRoute = forwardRef<SVGPathElement, { d: string; className: string }>(function BoardRoute({ d, className }, ref) {
  return (
    <path
      ref={ref}
      className={className}
      d={d}
      pathLength={1}
      fill="none"
      strokeWidth={2.4}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={{ strokeDashoffset: 1 - HEAD_START }}
    />
  );
});

/** The micromouse itself, from above, with its sensors reading the walls ahead and to each side. */
export const BoardMouse = forwardRef<SVGGElement, { start: { x: number; y: number }; sensorsClassName: string }>(function BoardMouse(
  { start, sensorsClassName },
  ref,
) {
  const top = MICE.top;
  const height = (MOUSE * top.height) / top.width;
  return (
    <g ref={ref} transform={`translate(${start.x} ${start.y})`}>
      <g className={sensorsClassName} strokeWidth={0.7} strokeLinecap="round">
        <path d="M8 0H22" />
        <path d="M6 -3L15 -11" />
        <path d="M6 3L15 11" />
      </g>
      <image
        href={top.src}
        width={MOUSE}
        height={height}
        x={-MOUSE / 2}
        y={-height / 2}
        transform={`rotate(${TOP_MOUSE_TURN})`}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
});

/**
 * Runs the mouse along the route as the page scrolls: at the top of a page it
 * sets off from its corner, and at the bottom it is in the gold room. The route
 * behind it is drawn in as it goes. `onRead` hears how far down the page is.
 * With reduced motion the route is drawn whole and the mouse waits in the centre.
 */
export function useScrollRun(
  routeRef: RefObject<SVGPathElement>,
  mouseRef: RefObject<SVGGElement>,
  onRead?: (read: number) => void,
  active = true,
) {
  useEffect(() => {
    const path = routeRef.current;
    const mouse = mouseRef.current;
    if (!active || !path || !mouse) return;
    const length = path.getTotalLength();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const read = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      onRead?.(read);

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
    // onRead is read fresh on every scroll through the closure; callers pass a stable one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, routeRef, mouseRef]);
}
