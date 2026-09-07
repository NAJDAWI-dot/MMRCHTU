"use client";

import { useEffect, useState } from "react";
import { Countdown } from "@/components/brand/Countdown";
import { EARLY_BIRD_SUBJECT } from "@/lib/countdown";

/**
 * The discount deadline, ticking, under the competition-day clock.
 *
 * A second clock in the same panel, deliberately drawn at the smallest of the
 * three scales. The two deadlines are not equals: one is the reason the site
 * exists and the other is a reason to act this week, and a visitor should be
 * able to tell which is which without reading either label. Same digits, same
 * gradient, same tick — a third of the size.
 *
 * A client component for one reason, and it is not the clock: it is the sentence
 * above it. The page around this is server-rendered against the offer being
 * live, and it stays that way until the route revalidates — five minutes on the
 * homepage, a minute on competition day. Somebody sitting on the page as the
 * cutoff passes would otherwise be told "20% off ends in" above a clock reading
 * zero. So the whole block removes itself the instant the offer ends, on a
 * single timeout armed for exactly that moment. No polling, and nothing on
 * screen that has stopped being true.
 *
 * The offer is still announced by the marquee and the notice on the register
 * page, and by the pill on every registration link, so nothing is lost when
 * this goes; the block that disappears is the urgency, which is the one thing
 * that genuinely expires.
 */
export function EarlyBirdCountdown({ percent, cutoff }: { percent: number; cutoff: Date }) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const ms = cutoff.getTime() - Date.now();
    if (ms <= 0) {
      setExpired(true);
      return;
    }

    // setTimeout clamps above the 32-bit signed millisecond ceiling and fires
    // immediately, which would hide a discount that is still running. A cutoff
    // more than 24 days out simply is not worth arming for: the route will
    // have revalidated many times over before it matters.
    const MAX_DELAY = 2 ** 31 - 1;
    if (ms > MAX_DELAY) return;

    const timer = window.setTimeout(() => setExpired(true), ms);
    return () => window.clearTimeout(timer);
  }, [cutoff]);

  if (expired) return null;

  return (
    <div className="mt-6 border-t border-ras-purple/20 pt-5 dark:border-white/15">
      {/*
        English only. The Arabic word the promotion was signed off with belongs
        to the pill and the ribbon, which are marks — a word set against a
        colour, doing no other work. This is a line of running text introducing
        a clock, and the same word inside it read as the phrase said twice.

        Crimson in the light theme and plain white in the dark one, rather than
        the crimson's own dark-theme tint. The moodboard palette is decorative
        by declaration — see the note above it in tailwind.config.ts — and every
        shade in it is dark enough to disappear into this panel's dark gradient.
      */}
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ras-crimson dark:text-white/75">
        Early bird {percent}% off ends in
      </p>
      <div className="mt-2.5 flex justify-center">
        <Countdown target={cutoff} size="sm" subject={EARLY_BIRD_SUBJECT} />
      </div>
    </div>
  );
}
