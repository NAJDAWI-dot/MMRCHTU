"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BOARD_SIZE, BOARD_SPAN, BOARD_VIEWBOX, BoardMouse, BoardRoute, BoardWalls, FloodNumbers, useBoard, useScrollRun } from "@/components/day-site/MazeBoard";
import {
  FULL_STAGE,
  INFECTION_ATTRIBUTE,
  INFECTION_PREVIEW_KEY,
  INFECTION_SEEN_KEY,
  SPREAD,
  infectionExempt,
  infectionStage,
  nextInfectionChange,
  readPreview,
} from "@/lib/infection";
import { CELL } from "@/lib/maze";

/** How long a day's new spread takes to run out across the board, in ms. */
const SPREAD_MS = 2600;
/** From which stage the micromouse runs the board as the page scrolls. */
const MOUSE_FROM = 4;
/** How many rings of cells make up the infection's front edge. */
const FRONT = 3;

function readStoredPreview(): number | null {
  try {
    const asked = readPreview(new URLSearchParams(window.location.search).get("infection"));
    if (asked === "live") sessionStorage.removeItem(INFECTION_PREVIEW_KEY);
    else if (asked !== undefined) sessionStorage.setItem(INFECTION_PREVIEW_KEY, String(asked));
    const kept = sessionStorage.getItem(INFECTION_PREVIEW_KEY);
    return kept === null ? null : Number(kept);
  } catch {
    return null;
  }
}

/**
 * The week before competition day, on the main site (see src/lib/infection.ts).
 *
 * Keeps <html data-infect> right: the inline script in the root layout sets it
 * before first paint, and this takes over from there, clearing it on the admin
 * pages, putting it back on the way out, and moving it on at the moment the
 * countdown drops a day in a tab that was left open.
 *
 * And draws the infection itself: the day site's maze, spreading out from its
 * gold centre along its own corridors in flood-fill order, the way a
 * micromouse numbers a maze. Only the cells it has reached are drawn, on the
 * day site's floor, so the site's own artwork is eaten away cell by cell. The
 * cells taken since a visitor last looked light up crimson and run out from
 * the edge they had reached, so a returning visitor sees the day's spread
 * happen. From the fourth stage the micromouse runs the board as the page
 * scrolls.
 *
 * Decoration: hidden from assistive technology and never in the way of a
 * click. With reduced motion the spread is simply there.
 */
export function InfectionLayer({ eventMs, enabled }: { eventMs: number | null; enabled: boolean }) {
  const pathname = usePathname();
  const [stage, setStage] = useState(0);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (infectionExempt(pathname)) {
      root.removeAttribute(INFECTION_ATTRIBUTE);
      setStage(0);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const asked = readStoredPreview();
      const now = Date.now();
      const next = asked ?? infectionStage(eventMs, now, enabled);
      if (next > 0) root.setAttribute(INFECTION_ATTRIBUTE, String(next));
      else root.removeAttribute(INFECTION_ATTRIBUTE);
      setStage(next);
      setPreview(asked !== null);
      const wait = asked === null ? nextInfectionChange(eventMs, now, enabled) : null;
      // setTimeout cannot wait longer than about 24.8 days; a longer wait just checks again.
      if (wait !== null) timer = setTimeout(apply, Math.min(wait, 2 ** 31 - 1));
    };
    apply();
    return () => clearTimeout(timer);
  }, [pathname, eventMs, enabled]);

  if (stage <= 0) return null;
  return <InfectionBoard key={`${stage}-${preview}`} stage={stage} preview={preview} />;
}

function InfectionBoard({ stage, preview }: { stage: number; preview: boolean }) {
  const { maze, route, flood, posts } = useBoard();
  const longest = useMemo(() => Math.max(...flood), [flood]);
  const reach = SPREAD[Math.min(stage, FULL_STAGE)]! * longest;

  // Where the spread had got to when this browser last looked, read on the
  // first render so the new cells never show before they are taken. The board
  // only ever renders in the browser, and is remounted for each stage. A
  // preview always plays its own day, so it can be watched.
  const [from] = useState(() => {
    if (preview) return stage - 1;
    try {
      const seen = Number(localStorage.getItem(INFECTION_SEEN_KEY)) || 0;
      return Math.min(seen, stage);
    } catch {
      return stage;
    }
  });
  useEffect(() => {
    if (preview) return;
    try {
      localStorage.setItem(INFECTION_SEEN_KEY, String(stage));
    } catch {}
  }, [stage, preview]);
  const fromReach = SPREAD[Math.max(0, from)]! * longest;
  const step = SPREAD_MS / Math.max(1, reach - fromReach);

  const routeRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef<SVGGElement>(null);
  const running = stage >= MOUSE_FROM;
  useScrollRun(routeRef, mouseRef, undefined, running);

  const cells = flood.map((distance, index) => ({ distance, x: (index % BOARD_SIZE) * CELL, y: Math.floor(index / BOARD_SIZE) * CELL }));
  const taken = cells.filter((cell) => cell.distance <= reach);
  const delay = (distance: number): CSSProperties | undefined =>
    distance > fromReach ? ({ "--infect-delay": `${Math.round((distance - fromReach) * step)}ms` } as CSSProperties) : undefined;
  const edge = stage < 5 ? taken.filter((cell) => cell.distance > reach - FRONT) : [];

  return (
    <div className="infect-layer" aria-hidden="true" data-stage={stage}>
      <svg viewBox={BOARD_VIEWBOX} preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* The cells the infection has reached, a little over-size so the walls and posts on their edges come too. */}
          <mask id="infect-reach" maskUnits="userSpaceOnUse" x={-6} y={-6} width={BOARD_SPAN + 12} height={BOARD_SPAN + 12}>
            {/* The whole board, out to the page's edges, once nothing is left to take. */}
            {reach >= longest ? (
              <rect
                x={-6}
                y={-6}
                width={BOARD_SPAN + 12}
                height={BOARD_SPAN + 12}
                fill="white"
                className={fromReach < longest ? "infect-take" : undefined}
                style={fromReach < longest ? ({ "--infect-delay": `${SPREAD_MS}ms` } as CSSProperties) : undefined}
              />
            ) : null}
            {taken.map((cell) => (
              <rect
                key={`${cell.x}-${cell.y}`}
                x={cell.x - 2}
                y={cell.y - 2}
                width={CELL + 4}
                height={CELL + 4}
                fill="white"
                className={cell.distance > fromReach ? "infect-take" : undefined}
                style={delay(cell.distance)}
              />
            ))}
          </mask>
        </defs>
        <g mask="url(#infect-reach)">
          <rect className="infect-floor" x={-6} y={-6} width={BOARD_SPAN + 12} height={BOARD_SPAN + 12} />
          {edge.map((cell) => (
            <rect key={`e${cell.x}-${cell.y}`} className="infect-edge" x={cell.x} y={cell.y} width={CELL} height={CELL} />
          ))}
          {taken.map((cell) =>
            cell.distance > fromReach ? (
              <rect key={`f${cell.x}-${cell.y}`} className="infect-flash" x={cell.x} y={cell.y} width={CELL} height={CELL} style={delay(cell.distance)} />
            ) : null,
          )}
        </g>
      </svg>

      {/* The maze's lines on a layer of their own, faded where the reading happens, as on the day site. */}
      <svg viewBox={BOARD_VIEWBOX} preserveAspectRatio="xMidYMid slice" className="infect-lines">
        <g mask="url(#infect-reach)">
          <FloodNumbers flood={flood} className="infect-flood" goalClassName="infect-goal" show={(distance) => distance <= reach} />
          {running ? <BoardRoute ref={routeRef} d={route.solution} className="infect-route" /> : null}
          <BoardWalls walls={maze.walls} posts={posts} prefix="infect-maze" />
        </g>
      </svg>

      {running ? (
        <svg viewBox={BOARD_VIEWBOX} preserveAspectRatio="xMidYMid slice" className="infect-runner">
          <g mask="url(#infect-reach)">
            <BoardMouse ref={mouseRef} start={route.start} sensorsClassName="infect-sensors" />
          </g>
        </svg>
      ) : null}
    </div>
  );
}
