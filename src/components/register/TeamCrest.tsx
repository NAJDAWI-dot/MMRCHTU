"use client";

import { useMemo } from "react";
import { crestFor } from "@/lib/crest";
import { CrestMaze } from "@/components/brand/CrestMaze";

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
 * The geometry and the hash live in `@/lib/crest` and are tested there, and
 * the drawing itself is `CrestMaze`, shared with the wall of crests on the
 * open day page. This file is the field-side arrangement and nothing else.
 */

export function TeamCrest({ name, size = 84 }: { name: string; size?: number }) {
  // Regenerated on every keystroke, which is fine — a 6×6 carve is a few
  // hundred operations — but memoised so React re-rendering the form for an
  // unrelated reason does not redraw a maze that has not changed.
  const crest = useMemo(() => crestFor(name), [name]);

  return (
    <div className="flex items-center gap-3">
      <div
        className="shrink-0 rounded-xl border border-ras-purple/20 bg-[var(--color-surface)] p-2 shadow-sm dark:border-white/15"
        style={{ width: size + 16, height: size + 16 }}
      >
        {crest ? (
          <CrestMaze
            maze={crest}
            size={size}
            label={`Generated crest for ${name.trim()}`}
            className="crest-in"
          />
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
            Made from your team name, so every team gets a different one.
          </>
        ) : (
          "Your team crest appears here as you type."
        )}
      </p>
    </div>
  );
}
