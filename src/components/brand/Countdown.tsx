"use client";

import { useEffect, useState } from "react";
import {
  countdownSentence,
  countdownUnits,
  remainingUntil,
  tickIntervalMs,
  type Remaining,
} from "@/lib/countdown";

/**
 * Ticking countdown to competition day.
 *
 * The arithmetic lives in @/lib/countdown and is tested there; this owns only
 * the clock and the markup.
 *
 * Nothing renders until after mount. The server and the browser never agree on
 * the current second, so rendering a live clock during SSR is a guaranteed
 * hydration mismatch — and the server's value would be stale by the time it
 * arrived anyway. The reserved space keeps the page from jumping when it lands.
 */

interface CountdownProps {
  /** When the event starts. */
  target: Date;
  /** Smaller variant for the homepage hero. */
  compact?: boolean;
  /** Shown once the target has passed. */
  doneLabel?: string;
}

export function Countdown({
  target,
  compact = false,
  doneLabel = "Competition day is here",
}: CountdownProps) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const update = () => setRemaining(remainingUntil(target));
    update();

    // Re-armed each tick rather than set once: the cadence changes from once a
    // minute to once a second as the event nears, and a fixed interval would
    // either burn a re-render a second for months or miss the switch entirely.
    let timer: number;
    const schedule = () => {
      const next = remainingUntil(target);
      setRemaining(next);
      if (next.done) return;
      timer = window.setTimeout(schedule, tickIntervalMs(next));
    };
    timer = window.setTimeout(schedule, tickIntervalMs(remainingUntil(target)));

    return () => window.clearTimeout(timer);
  }, [target]);

  if (!remaining) {
    // Same height as the real thing, so nothing below it shifts on arrival.
    return <div className={compact ? "h-[58px]" : "h-[92px]"} aria-hidden="true" />;
  }

  if (remaining.done) {
    return (
      <p className="font-display text-xl font-bold uppercase tracking-widest text-accent">
        {doneLabel}
      </p>
    );
  }

  const units = countdownUnits(remaining);

  return (
    <div>
      {/*
        The digits are decorative for assistive tech: read one unit at a time
        they are gibberish, and an aria-live region updating every second would
        talk over everything else. One sentence is announced instead.
      */}
      <div
        className="flex flex-wrap items-end justify-center gap-3 sm:gap-4"
        aria-hidden="true"
      >
        {units.map((unit) => (
          <div key={unit.label} className="text-center">
            {/*
              Keyed on the value, so a digit that changes is a new element and
              replays the tick. Without it the clock silently swaps numbers and
              the one genuinely live thing on the page reads as static text.

              The gradient sits on this same element rather than on the row, so
              that it travels with the tick's transform. On the row it would
              stay put while the glyph slid out from under it, and the digit
              would vanish for the length of the animation — background-clip
              paints only where the element's own background box reaches.
            */}
            <div
              key={unit.value}
              className={`countdown-digit tick-in font-display font-extrabold tabular-nums ${
                compact ? "text-3xl" : "text-5xl"
              }`}
            >
              {unit.value}
            </div>
            <div
              className={`mt-0.5 uppercase tracking-widest text-ras-gray dark:text-white/60 ${
                compact ? "text-[10px]" : "text-xs"
              }`}
            >
              {unit.label}
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">{countdownSentence(remaining)}</p>
    </div>
  );
}
