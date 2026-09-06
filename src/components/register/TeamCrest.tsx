"use client";

import { useMemo } from "react";
import { CELL, MAZE_GOLD } from "@/lib/maze";
import { crestFor } from "@/lib/crest";

/**
 * A team's crest, generated from its name while they type it.
 *
 * The first thing a team gets is usually a confirmation email. This is
 * something they get before they have built anything, paid anything or
 * submitted anything: type a name, and a maze that is theirs appears beside
 * it. Drawn by the competition's own generator, seeded by the name, so it is
 * the same crest when they come back — and demonstrably not the same as
 * anybody else's.
 *
 * The geometry and the hash live in `@/lib/crest` and are tested there. This
 * file is only presentation.
 */

export function TeamCrest({ name, size = 84 }: { name: string; size?: number }) {
  // Regenerated on every keystroke, which is fine — a 6×6 carve is a few
  // hundred operations — but memoised so React re-rendering the form for an
  // unrelated reason does not redraw a maze that has not changed.
  const crest = useMemo(() => crestFor(name), [name]);
  const span = crest ? crest.size * CELL : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="shrink-0 rounded-xl border border-ras-purple/20 bg-[var(--color-surface)] p-2 shadow-sm dark:border-white/15"
        style={{ width: size + 16, height: size + 16 }}
      >
        {crest ? (
          <svg
            viewBox={crest.viewBox}
            width={size}
            height={size}
            role="img"
            aria-label={`Generated crest for ${name.trim()}`}
            className="crest-in"
          >
            {/* The goal block first, so the walls draw over its edges. */}
            <rect
              x={crest.goal.x + 2}
              y={crest.goal.y + 2}
              width={crest.goal.size - 4}
              height={crest.goal.size - 4}
              rx={3}
              fill={MAZE_GOLD}
              fillOpacity={0.2}
              stroke={MAZE_GOLD}
              strokeWidth={2}
            />
            {/* The way in, kept faint: the crest is a picture, not a puzzle to
                be solved at 84 pixels. */}
            <path
              d={crest.routes[0]!.solution}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke={MAZE_GOLD}
              strokeOpacity={0.45}
            />
            {crest.walls.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                strokeWidth={2.4}
                strokeLinecap="round"
                className="stroke-ras-purple dark:stroke-white/85"
              />
            ))}
            {/* Encloses the crest, so it reads as a badge rather than as a
                fragment of a larger maze that has been cropped. */}
            <rect
              x={0}
              y={0}
              width={span}
              height={span}
              fill="none"
              strokeWidth={2.4}
              className="stroke-ras-purple dark:stroke-white/85"
            />
          </svg>
        ) : (
          <div
            aria-hidden="true"
            style={{ width: size, height: size }}
            className="grid grid-cols-3 grid-rows-3 rounded-md border border-dashed border-ras-gray/30 opacity-60 dark:border-white/20"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="border border-dashed border-ras-gray/15 dark:border-white/10" />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-ras-gray dark:text-white/60">
        {crest ? (
          <>
            <span className="font-semibold text-ras-purple dark:text-white">Your team crest.</span>{" "}
            Generated from your name — no two teams get the same one.
          </>
        ) : (
          "Your team crest appears here as you type."
        )}
      </p>
    </div>
  );
}
