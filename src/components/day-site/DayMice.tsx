/**
 * Cheddar and friends on the day site: the five drawings from
 * public/brand/cheddar, each with a job, and each only ever where there was
 * nothing to cover.
 *
 * - The top-down mouse is the micromouse: it runs the hero maze and the maze
 *   behind every page (HeroMaze, DayBackdrop).
 * - A mouse peeks over the wall under a page's title, in the empty space to
 *   its right, on screens wide enough to have that space.
 * - A face looks into an empty section.
 * - The dancer stands on the finish line in the footer, and celebrates the
 *   champions.
 *
 * All of them are decoration in the strict sense: hidden from screen readers,
 * never in the way of a click, and still (not gone) for anyone who asked for
 * reduced motion. See the day-mouse rules in src/styles/day.css.
 */

import type { CSSProperties } from "react";

export const MICE = {
  stand: { src: "/brand/cheddar/cheddar-1.webp", width: 900, height: 1000 },
  face: { src: "/brand/cheddar/cheddar-2.webp", width: 900, height: 680 },
  dance: { src: "/brand/cheddar/cheddar-3.webp", width: 900, height: 1011 },
  peer: { src: "/brand/cheddar/cheddar-4.webp", width: 900, height: 1085 },
  top: { src: "/brand/cheddar/cheddar-5.webp", width: 900, height: 790 },
} as const;

export type MouseName = keyof typeof MICE;

/** The top-down drawing faces down and to the right; this turns its nose to +x. */
export const TOP_MOUSE_TURN = -45;

function MouseImg({ name, className = "", style, eager = false }: { name: MouseName; className?: string; style?: CSSProperties; eager?: boolean }) {
  const mouse = MICE[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small, transparent, already sized for the web
    <img
      src={mouse.src}
      alt=""
      width={mouse.width}
      height={mouse.height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={className}
      style={style}
    />
  );
}

const PEEKERS: MouseName[] = ["peer", "face", "stand"];

/** A small, steady hash, so a page always gets the same mouse. */
function pick(key: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % count;
}

/**
 * A mouse looking over the wall under a page's title: the wall hides its body,
 * so only the head and paws show. Sits at the right of the wall, where a page
 * head never has anything, and only from large screens up.
 */
export function PeekingMouse({ page }: { page: string }) {
  const name = PEEKERS[pick(page, PEEKERS.length)]!;
  const flip = pick(`${page}!`, 2) === 1;
  return (
    <span
      aria-hidden="true"
      className={`day-peek pointer-events-none absolute bottom-full right-6 hidden h-[7.25rem] w-[6.75rem] select-none overflow-hidden lg:block xl:right-12 ${flip ? "-scale-x-100" : ""}`}
    >
      <MouseImg name={name} eager className={`day-peek-mouse absolute left-0 w-full ${name === "face" ? "-bottom-[8%]" : "-bottom-[46%]"}`} />
    </span>
  );
}

/** A face looking into an empty box from over its top edge. */
export function EmptyMouse() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 block w-[4.75rem] -translate-x-1/2 -translate-y-[62%] select-none">
      <MouseImg name="face" className="day-mouse-tilt w-full" />
    </span>
  );
}

/** The dancer, on the footer's chequered finish line, in the space under the page. */
export function FinishMouse() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute bottom-[calc(100%-0.35rem)] right-[6%] block w-[4.6rem] select-none sm:w-[5.25rem]">
      <MouseImg name="dance" className="day-mouse-hop w-full" />
    </span>
  );
}

/** Any of the mice, placed by the caller: for the hall screen's wide open panels. */
export function DayMouse({ name, className = "", flip = false, move }: { name: MouseName; className?: string; flip?: boolean; move?: "hop" | "tilt" }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none block select-none ${flip ? "-scale-x-100" : ""} ${className}`}>
      <MouseImg name={name} className={`w-full ${move === "hop" ? "day-mouse-hop" : move === "tilt" ? "day-mouse-tilt" : ""}`} />
    </span>
  );
}

/** The dancer again, for the champions. */
export function CelebratingMouse({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none block select-none ${flip ? "-scale-x-100" : ""} ${className}`}>
      <MouseImg name="dance" className="day-mouse-hop w-full" />
    </span>
  );
}
