"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The depth cards under the hero.
 *
 * Built around what this competition actually is. A micromouse solves a maze,
 * and a maze is walls standing on a floor — so each card is a lit slab of that
 * floor with its contents standing off it at different heights, rather than a
 * rectangle that happens to tilt. The grid plate sits below the surface, the
 * heading and the link stand above it, and the gap between them is what the
 * parallax is showing: tilt the slab and the near things travel further than
 * the far ones, exactly as they would on a real one.
 *
 * The tilt is driven from the pointer but applied entirely in CSS, through four
 * custom properties. JavaScript writes numbers; the compositor does the work,
 * which is what keeps it smooth on a phone.
 */

export interface FeatureCardData {
  href: string;
  title: string;
  blurb: string;
  cta: string;
}

/** Maximum rotation, in degrees. Past about eight the text starts to distort. */
const MAX_TILT = 7;

export function FeatureCard({
  card,
  accent,
  seed,
}: {
  card: FeatureCardData;
  /** Decorative only — the glow and the sheen. Text keeps the accent token. */
  accent: string;
  /** Shifts the floor grid so the three slabs are not the same tile twice. */
  seed: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  /**
   * Whether to tilt at all.
   *
   * Two reasons not to, and they are different. A visitor who asked for less
   * motion should not get a slab that leans when the pointer crosses it. And a
   * touch screen has no pointer to track: on a phone the card would either sit
   * flat forever or lurch once on tap, so it keeps its resting elevation and
   * nothing else.
   */
  const [tilts, setTilts] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setTilts(fine.matches && !still.matches);
    decide();
    fine.addEventListener("change", decide);
    still.addEventListener("change", decide);
    return () => {
      fine.removeEventListener("change", decide);
      still.removeEventListener("change", decide);
    };
  }, []);

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!tilts) return;
      const el = ref.current;
      if (!el) return;

      const { left, top, width, height } = el.getBoundingClientRect();
      // -0.5 … 0.5 from the centre of the card.
      const px = (event.clientX - left) / width - 0.5;
      const py = (event.clientY - top) / height - 0.5;

      // One write per frame. Pointer events fire far faster than the screen
      // refreshes, and every extra write is a style recalculation nobody sees.
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        // Y follows the horizontal position, X the vertical and inverted, so
        // the corner under the pointer is the corner that comes towards you.
        el.style.setProperty("--ry", `${px * MAX_TILT * 2}deg`);
        el.style.setProperty("--rx", `${-py * MAX_TILT * 2}deg`);
        el.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
        el.style.setProperty("--my", `${(py + 0.5) * 100}%`);
      });
    },
    [tilts],
  );

  const reset = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "0%");
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <div className="card3d-scene">
      <div
        ref={ref}
        className="card3d"
        data-tilts={tilts ? "" : undefined}
        style={{ ["--card-accent" as string]: accent, ["--seed" as string]: `${seed * 7}px` }}
        onPointerMove={onMove}
        onPointerLeave={reset}
      >
        {/*
          Everything decorative lives on one sunken plate, and the plate clips.
          The wall's glow is a blurred element wider than the card, and without
          a clipping parent it escapes and hazes the two cards either side —
          which is what it did on the first build. Clipping here rather than on
          the card itself matters: overflow on the card would flatten the
          content's Z layers and take the parallax with it.
        */}
        <span aria-hidden="true" className="card3d-plate">
          <span className="card3d-floor" />
          <span className="card3d-glow" />
        </span>
        {/* The light. Follows the pointer, so the slab reads as lit from a
            point rather than evenly filled. A gradient background is already
            clipped to the border box, so this needs no plate of its own. */}
        <span aria-hidden="true" className="card3d-sheen" />

        <div className="card3d-content">
          <h2 className="card3d-title font-display text-lg font-bold text-ras-purple dark:text-white">
            {card.title}
          </h2>
          <p className="card3d-blurb mt-2 text-sm text-ras-gray dark:text-white/70">{card.blurb}</p>
          <Link
            href={card.href}
            className="card3d-cta -mx-2 mt-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-accent hover:underline"
          >
            {card.cta} <span aria-hidden="true" className="card3d-arrow ml-1">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
