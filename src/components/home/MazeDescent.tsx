"use client";

import { useEffect, useRef } from "react";
import { MAZE_GOLD } from "@/lib/maze";
import { descentPath, descentProgress } from "@/lib/descent";

/**
 * A corridor down the side of the homepage, drawn as you scroll.
 *
 * Scrolling the page is the visitor's first act on the site, and it was doing
 * nothing except moving content. Here it maps a corridor: the line draws in
 * behind a mouse working its way down, so the act of reading the homepage is
 * the same act the competition is about. By the footer, the run is complete.
 *
 * Lives in the outer margin and only from `xl` up, where that margin exists —
 * below it the content is the full width of the screen and there is nowhere to
 * put a corridor that is not on top of something.
 *
 * The geometry is a pure function (`@/lib/descent`) so it can be tested; this
 * file owns only the scroll plumbing.
 */

/** User units. The height is nominal — the SVG stretches to whatever it is given. */
const WIDTH = 60;
const HEIGHT = 1200;
const SEGMENTS = 9;

export function MazeDescent() {
  const pathRef = useRef<SVGPathElement>(null);
  const drawnRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const drawn = drawnRef.current;
    const mouse = mouseRef.current;
    if (!path || !drawn || !mouse) return;

    const total = path.getTotalLength();
    drawn.style.strokeDasharray = `${total}`;

    const apply = (progress: number) => {
      drawn.style.strokeDashoffset = `${total * (1 - progress)}`;
      // The marker is an HTML element rather than part of the drawing. The SVG
      // is stretched vertically to fit the page, and anything inside it would
      // be stretched with it — a mouse pulled into a smear. Positioning it in
      // percentages keeps it round.
      const point = path.getPointAtLength(total * progress);
      mouse.style.left = `${(point.x / WIDTH) * 100}%`;
      mouse.style.top = `${progress * 100}%`;
    };

    // Reduced motion keeps the corridor and drops the tracking: the drawing is
    // the idea, the movement is only how it arrives.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(1);
      return;
    }

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply(
          descentProgress(
            window.scrollY,
            document.documentElement.scrollHeight,
            window.innerHeight,
          ),
        );
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const d = descentPath(SEGMENTS, WIDTH, HEIGHT);

  return (
    <div
      aria-hidden="true"
      className="maze-descent pointer-events-none absolute inset-y-0 left-[-5rem] hidden w-16 select-none xl:block"
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {/* The corridor not yet travelled, and the part that has been. */}
        <path
          ref={pathRef}
          d={d}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ras-purple/15 dark:stroke-white/15"
        />
        <path
          ref={drawnRef}
          d={d}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={MAZE_GOLD}
          strokeOpacity={0.75}
        />
      </svg>

      <span
        ref={mouseRef}
        style={{ backgroundColor: MAZE_GOLD }}
        className="absolute -ml-[9px] -mt-[9px] block h-[18px] w-[18px] rounded-full shadow-[0_0_10px_2px_rgba(242,169,0,0.45)]"
      />
    </div>
  );
}
