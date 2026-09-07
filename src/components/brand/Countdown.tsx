"use client";

import { useEffect, useState } from "react";
import {
  COMPETITION_DAY_SUBJECT,
  countdownSentence,
  countdownUnits,
  remainingUntil,
  tickIntervalMs,
  type CountdownSubject,
  type Remaining,
} from "@/lib/countdown";

/**
 * Ticking countdown to a deadline.
 *
 * The arithmetic lives in @/lib/countdown and is tested there; this owns only
 * the clock and the markup.
 *
 * Nothing renders until after mount. The server and the browser never agree on
 * the current second, so rendering a live clock during SSR is a guaranteed
 * hydration mismatch — and the server's value would be stale by the time it
 * arrived anyway. The reserved space keeps the page from jumping when it lands.
 */

export type CountdownSize = "lg" | "md" | "sm";

/**
 * The three scales, chosen by name rather than by classes passed in from
 * outside.
 *
 * Every dimension moves together — digits, labels, the gap between units, and
 * the height held open before the clock arrives. A caller allowed to override
 * one of them gets a reserved space that no longer matches what fills it, and
 * the page jumps on mount. Naming the whole set here makes that impossible.
 */
const SIZES: Record<
  CountdownSize,
  { digit: string; label: string; gap: string; done: string; reserved: string }
> = {
  lg: {
    digit: "text-5xl",
    label: "text-xs",
    gap: "gap-3 sm:gap-4",
    done: "text-xl",
    reserved: "h-[92px]",
  },
  md: {
    digit: "text-3xl",
    label: "text-[10px]",
    gap: "gap-3 sm:gap-4",
    done: "text-lg",
    reserved: "h-[58px]",
  },
  sm: {
    digit: "text-xl",
    label: "text-[9px]",
    gap: "gap-2 sm:gap-3",
    done: "text-sm",
    reserved: "h-[44px]",
  },
};

interface CountdownProps {
  /** The moment being counted down to. */
  target: Date;
  /** How large to draw it. Defaults to the full-size hero clock. */
  size?: CountdownSize;
  /** What the clock counts towards, for the sentence read out in its place. */
  subject?: CountdownSubject;
  /** Shown once the target has passed. Defaults to the subject's own label. */
  doneLabel?: string;
}

export function Countdown({
  target,
  size = "lg",
  subject = COMPETITION_DAY_SUBJECT,
  doneLabel,
}: CountdownProps) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const scale = SIZES[size];

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
    return <div className={scale.reserved} aria-hidden="true" />;
  }

  if (remaining.done) {
    return (
      <p className={`font-display font-bold uppercase tracking-widest text-accent ${scale.done}`}>
        {doneLabel ?? subject.arrivedLabel}
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
      <div className={`flex flex-wrap items-end justify-center ${scale.gap}`} aria-hidden="true">
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
              className={`countdown-digit tick-in font-display font-extrabold tabular-nums ${scale.digit}`}
            >
              {unit.value}
            </div>
            <div
              className={`mt-0.5 uppercase tracking-widest text-ras-gray dark:text-white/60 ${scale.label}`}
            >
              {unit.label}
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">{countdownSentence(remaining, subject)}</p>
    </div>
  );
}
