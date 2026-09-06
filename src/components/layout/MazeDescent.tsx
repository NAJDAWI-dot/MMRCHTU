"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MAZE_GOLD } from "@/lib/maze";
import { descentPath, descentProgress } from "@/lib/descent";

/**
 * A corridor down the side of every public page, drawn as you scroll.
 *
 * Scrolling is the visitor's first act on the site, and it was doing nothing
 * except moving content. Here it maps a corridor: the line draws in behind a
 * marker working its way down, so reading a page is the same act the
 * competition is about. At the footer, the run is complete.
 *
 * Fixed to the viewport rather than positioned inside a page's container. It
 * began life on the landing page, hugging that page's own margin — but every
 * page has a different container width, so hugging any one of them could not
 * generalise. A rail at a fixed offset from the window edge sits in the margin
 * on all of them and couples to none.
 *
 * Which is also why it is mounted in the root layout beside AmbientMice rather
 * than inside a page: that is outside PageTransition, and PageTransition
 * animates `transform`. An element with a transform applied is a containing
 * block for fixed-position descendants, so mounted any deeper this would
 * resolve against the animating wrapper instead of the viewport — the same
 * trap AmbientMice and CheddarCelebration both document.
 *
 * Only from `xl` up, where a margin exists at all: below that the content is
 * the full width of the screen and there is nowhere to put a corridor that is
 * not on top of something. And never over the admin, which is a tool rather
 * than a page anyone reads down.
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
  // Read on every render rather than once: this component is mounted in the
  // layout and is never remounted, so a navigation has to be noticed here.
  const pathname = usePathname() ?? "";
  const offAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (offAdmin) return;
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
    // Re-measured on navigation: the next page is a different length, and the
    // corridor would otherwise keep the progress of the page just left.
  }, [offAdmin, pathname]);

  const d = descentPath(SEGMENTS, WIDTH, HEIGHT);

  if (offAdmin) return null;

  return (
    <div
      aria-hidden="true"
      /*
        Left of the widest content column the site uses (72rem, centred), so it
        sits in the margin on every page rather than over any of them.
      */
      className="maze-descent pointer-events-none fixed left-3 top-0 z-0 hidden h-screen w-10 select-none xl:block"
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
