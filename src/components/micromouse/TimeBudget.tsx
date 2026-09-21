"use client";

import { useMemo, useState } from "react";
import { formatScore } from "@/lib/rules";
import { MATCH_SECONDS, planMatch } from "@/lib/micromouse";

/**
 * The eight minutes, spent.
 *
 * The score formula is the most important thing in the rulebook and the least
 * intuitive: runs divided by your fastest run, so the mouse that finishes five
 * times beats the faster mouse that finished once. Written out as a formula
 * people nod at it. With three sliders under it they argue with it, and then
 * they believe it.
 *
 * The reset slider is the one that surprises teams. Carrying the mouse back and
 * restarting it is charged at exactly the same rate as driving, and over six
 * runs a slow reset costs more than the driving does.
 */

export function TimeBudget() {
  const [searchSeconds, setSearch] = useState(110);
  const [speedSeconds, setSpeed] = useState(24);
  const [resetSeconds, setReset] = useState(12);

  const plan = useMemo(
    () => planMatch({ searchSeconds, speedSeconds, resetSeconds }),
    [searchSeconds, speedSeconds, resetSeconds],
  );

  // The same mouse, stopping after one speed run. Not a worse robot: a worse
  // decision.
  const stopAfterOne = useMemo(
    () =>
      planMatch({
        searchSeconds,
        speedSeconds,
        resetSeconds,
        matchSeconds: searchSeconds + speedSeconds + resetSeconds * 2,
      }),
    [searchSeconds, speedSeconds, resetSeconds],
  );

  const segments = useMemo(() => {
    const out: { label: string; seconds: number; kind: "search" | "run" | "reset" }[] = [
      { label: "Search", seconds: searchSeconds, kind: "search" },
      { label: "Reset", seconds: resetSeconds, kind: "reset" },
    ];
    for (let i = 1; i < plan.runs; i++) {
      out.push({ label: `Run ${i + 1}`, seconds: speedSeconds, kind: "run" });
      out.push({ label: "Reset", seconds: resetSeconds, kind: "reset" });
    }
    return out;
  }, [plan.runs, searchSeconds, speedSeconds, resetSeconds]);

  return (
    <div className="not-prose rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[230px_minmax(0,1fr)] sm:items-start">
        <div className="space-y-4">
          <Slider id="tb-search" label="Search run" value={searchSeconds} min={30} max={300} step={5} onChange={setSearch} />
          <Slider id="tb-speed" label="Each speed run" value={speedSeconds} min={8} max={90} step={1} onChange={setSpeed} />
          <Slider id="tb-reset" label="Carry back and restart" value={resetSeconds} min={3} max={60} step={1} onChange={setReset} />
          <p className="text-xs leading-relaxed text-ras-gray dark:text-white/55">
            The clock runs for all eight minutes, including the resets, the battery change and the
            one where you crouch down and think.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Figure label="Runs that finish" value={plan.overruns ? "0" : String(plan.runs)} />
            <Figure
              label="Official time"
              value={plan.overruns ? "none" : `${plan.officialSeconds}s`}
            />
            <Figure label="Score" value={formatScore(plan.score)} big />
          </div>

          {/* The match as a bar, because "455 of 480 seconds" is a number and
              this is a picture of a slot running out. */}
          <div
            className="mt-4 flex h-7 w-full overflow-hidden rounded-md border border-ras-purple/25 dark:border-white/20"
            role="img"
            aria-label={`An eight minute match: ${plan.runs} runs and ${plan.spareSeconds} seconds unused.`}
          >
            {segments.map((segment, i) => (
              <div
                key={`${segment.label}-${i}`}
                title={`${segment.label}: ${segment.seconds}s`}
                style={{ width: `${(segment.seconds / MATCH_SECONDS) * 100}%` }}
                className={
                  segment.kind === "search"
                    ? "bg-ras-purple/80"
                    : segment.kind === "run"
                      ? "bg-ras-crimson/80"
                      : "bg-ras-gray/25 dark:bg-white/20"
                }
              />
            ))}
            <div className="flex-1 bg-transparent" />
          </div>
          <p className="mt-1 text-xs text-ras-gray dark:text-white/55">
            {plan.overruns
              ? "That search does not fit inside the match at all."
              : `${plan.usedSeconds}s used, ${plan.spareSeconds}s left on the clock.`}
          </p>

          <div className="mt-5 rounded-xl border border-ras-purple/20 bg-ras-purple/5 p-4 dark:border-white/15 dark:bg-white/5">
            <p className="text-sm leading-relaxed text-ras-gray dark:text-white/75">
              The same mouse, stopping after one speed run, scores{" "}
              <strong className="text-ras-purple dark:text-white">
                {formatScore(stopAfterOne.score)}
              </strong>{" "}
              from {stopAfterOne.runs} runs. Keeping it going scores{" "}
              <strong className="text-ras-purple dark:text-white">{formatScore(plan.score)}</strong>{" "}
              from {plan.runs}. Same robot, same fastest lap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div
        className={`font-display font-extrabold tabular-nums text-ras-purple dark:text-white ${
          big ? "text-4xl" : "text-2xl"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-ras-gray dark:text-white/55">
        {label}
      </div>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-sm font-semibold text-ras-purple dark:text-white"
      >
        {label}
        <span className="font-mono text-xs text-ras-gray dark:text-white/60">{value}s</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-ras-crimson"
      />
    </div>
  );
}
