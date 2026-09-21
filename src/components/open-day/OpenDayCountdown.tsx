"use client";

import { useEffect, useMemo, useState } from "react";
import { Countdown } from "@/components/brand/Countdown";
import { OPEN_DAY_END_SUBJECT, OPEN_DAY_SUBJECT } from "@/lib/countdown";
import {
  nextOpenDayBoundary,
  openDayClock,
  openDayDateLabel,
  openDayPhase,
  type OpenDayPhase,
} from "@/lib/open-day";

/**
 * The clock for the stand, and the one thing on this page that is only on this
 * page.
 *
 * It counts to three different things over the course of a day, because "days
 * until" stops being useful at exactly the moment the day arrives. Before the
 * doors open it counts to them. Once they are open it counts to closing time,
 * which is the number a visitor reading it in the hall actually wants. After
 * that it stops counting and says so, rather than sitting at zero or, worse,
 * quietly counting up.
 *
 * The digits, the tick and the gradient are the site's own `Countdown`, the
 * same object as the competition-day clock on the homepage. The arithmetic is
 * in `@/lib/open-day` and is tested there against fixed dates, so the awkward
 * moments — the second the stand opens, the second it shuts — do not have to
 * be caught by watching a page.
 */

// setTimeout stores its delay in a signed 32-bit integer, and anything past
// that ceiling fires immediately instead of in a month. A boundary further
// out than this needs no timer: the page is reloaded many times before it
// matters, and each load arms the clock again.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function OpenDayCountdown({
  startsAt,
  endsAt,
  location = "",
  mapUrl = "",
}: {
  startsAt: string;
  endsAt: string;
  /** Where the stand is, as an admin typed it. Empty means say nothing. */
  location?: string;
  /**
   * A map for that place, as its own link.
   *
   * Kept out of the location text on purpose: pasted in there it printed as a
   * line of raw URL in the middle of a sentence, and it was not clickable.
   * Already checked to be http or https by the time it arrives here.
   */
  mapUrl?: string;
}) {
  // ISO strings across the boundary rather than Dates, so the identity of this
  // object is stable across renders and the effect below is not re-armed on
  // every one of them.
  const day = useMemo(
    () => ({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) }),
    [startsAt, endsAt],
  );

  // Null until mounted. The server has its own idea of the current second, and
  // rendering a live clock into the markup is a hydration mismatch by
  // construction, so the phase is decided in the browser.
  const [phase, setPhase] = useState<OpenDayPhase | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    const update = () => {
      setPhase(openDayPhase(day));

      const next = nextOpenDayBoundary(day);
      if (!next) return;

      const ms = next.getTime() - Date.now();
      if (ms <= 0 || ms > MAX_TIMEOUT_MS) return;
      // A little past the boundary rather than exactly on it: timers fire a
      // hair early often enough that landing on the edge means recomputing the
      // same phase and arming a zero-length timer.
      timer = window.setTimeout(update, ms + 500);
    };

    update();
    return () => window.clearTimeout(timer);
  }, [day]);

  const where = location.trim();
  const dateLabel = where ? `${openDayDateLabel(day)} · ${where}` : openDayDateLabel(day);
  const closing = openDayClock(day.endsAt);
  const here = where ? `We are at ${where} until ${closing}.` : `We are at the stand until ${closing}.`;

  return (
    /* `isolate` keeps the glows behind the digits: it makes this the stacking
       context, so the -z-10 below lands above the panel's gradient but under
       everything written on top of it. The same arrangement as the homepage
       panel, and it breaks the same way without it. */
    <div className="relative isolate mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl border border-ras-purple/40 bg-gradient-to-br from-mood-orchid/25 via-ras-purple/10 to-mood-rose/25 px-5 py-6 text-center shadow-lg shadow-ras-purple/10 sm:px-8 dark:border-mood-violet/45 dark:from-mood-violet/30 dark:via-transparent dark:to-mood-rose/30 dark:shadow-none">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 -z-10 h-44 w-44 rounded-full bg-mood-rose/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 -z-10 h-48 w-48 rounded-full bg-mood-orchid/25 blur-3xl"
      />

      <p className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
        {phase === "during" ? (
          <>
            <LiveDot />
            Happening now. Stand closes in
          </>
        ) : phase === "after" ? (
          "The stand is packed up"
        ) : (
          "Open day starts in"
        )}
      </p>

      {/* One height for all three states, so the four buttons under the panel
          do not jump down the screen when the clock arrives or the day turns
          over. 58px of digits plus their labels, matching Countdown's own
          reserved space at this size. */}
      <div className="mt-4 flex min-h-[58px] items-center justify-center">
        {phase === null ? (
          <div className="h-[58px]" aria-hidden="true" />
        ) : phase === "after" ? (
          <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
            Thanks for stopping by
          </p>
        ) : (
          <Countdown
            target={phase === "during" ? day.endsAt : day.startsAt}
            size="md"
            subject={phase === "during" ? OPEN_DAY_END_SUBJECT : OPEN_DAY_SUBJECT}
          />
        )}
      </div>

      {/* Rendered on the server as well as in the browser: it is a fixed date
          in a fixed zone, so it is the same string in both, and a visitor whose
          JavaScript has not arrived yet still learns when to turn up. */}
      <p className="mt-4 text-sm text-ras-gray dark:text-white/70">
        {phase === "during"
          ? `${here} Come and say hello.`
          : phase === "after"
            ? "Everything below is still here, and registration is still open."
            : dateLabel}
      </p>

      {mapUrl ? (
        <p>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="-mx-2 mt-1 inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-sm font-semibold text-accent hover:underline"
          >
            Find it on the map
            <span aria-hidden="true">↗</span>
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** The dot that says the stand is open right now rather than some other day. */
function LiveDot() {
  return (
    <span aria-hidden="true" className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ras-crimson/70 motion-reduce:hidden dark:bg-[#ff9b9b]/70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-ras-crimson dark:bg-[#ff9b9b]" />
    </span>
  );
}
