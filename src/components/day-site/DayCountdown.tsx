"use client";

import { useEffect, useState } from "react";
import { COMPETITION_DAY_SUBJECT, countdownSentence, remainingUntil, tickIntervalMs, type Remaining } from "@/lib/countdown";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The wait for the day, set like a timing board: days, hours, minutes and
 * seconds in cells divided by walls. The arithmetic is @/lib/countdown's, the
 * same as the main site's clock; only the look is the day site's.
 *
 * Nothing but the reserved space renders until after mount: the server and
 * the browser never agree on the current second.
 */
export function DayCountdown({ target }: { target: Date }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const next = remainingUntil(target);
      setRemaining(next);
      if (!next.done) timer = window.setTimeout(tick, tickIntervalMs(next));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [target]);

  if (!remaining) return <div className="h-[5.25rem]" aria-hidden="true" />;
  if (remaining.done) return <p className="day-display text-2xl text-day-crimson">{COMPETITION_DAY_SUBJECT.arrivedLabel}</p>;

  const cells = [
    { value: String(remaining.days), label: remaining.days === 1 ? "day" : "days" },
    { value: pad(remaining.hours), label: "hours" },
    { value: pad(remaining.minutes), label: "min" },
    { value: pad(remaining.seconds), label: "sec" },
  ];
  return (
    <div>
      <ol className="day-card day-posts inline-grid grid-cols-4 gap-px overflow-hidden bg-day-line/[0.12]" aria-hidden="true">
        {cells.map((cell) => (
          <li key={cell.label} className="min-w-[4.5rem] bg-day-surface px-3 py-2.5 text-center sm:min-w-[5.25rem]">
            <span className="day-num day-display block text-[2.1rem] leading-none text-day-ink sm:text-[2.5rem]">{cell.value}</span>
            <span className="mt-1 block text-xs font-semibold text-day-muted">{cell.label}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only">{countdownSentence(remaining, COMPETITION_DAY_SUBJECT)}</p>
    </div>
  );
}
