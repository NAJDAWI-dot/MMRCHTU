"use client";

import { useId, useState } from "react";
import { RULES, finalScore, formatScore } from "@/lib/rules";
import { Figure, Stat } from "@/components/rules/Figure";

/**
 * The score formula, made playable.
 *
 * This is the rule that changed most in rulebook 1.1, and the one whose shape
 * is least obvious from reading it. Ranking used to be "fastest single run
 * wins", which needs no diagram because everyone already holds that model. It
 * is now runs divided by time, and that inverts the strategy: a mouse can be
 * the quickest in the room on its best lap and still finish below a slower one
 * that got round four times.
 *
 * The rulebook makes exactly that point with two worked examples, so those two
 * teams are pinned on screen as fixed reference marks. Whatever the reader
 * types is ranked against them live, which turns "4 runs at 25s beats 1 at 18s"
 * from a sentence you nod at into a result you watched happen.
 */

/** The rulebook's own worked examples, quoted rather than invented. */
const REFERENCES = [
  { name: "Team A", runs: 4, seconds: 25 },
  { name: "Team B", runs: 1, seconds: 18 },
] as const;

const MAX_RUNS = 12;
const MAX_SECONDS = 120;

export function ScoreFormula() {
  const [runs, setRuns] = useState(3);
  const [seconds, setSeconds] = useState(30);
  const runsId = useId();
  const secondsId = useId();

  const score = finalScore(runs, seconds);

  const rows = [
    { name: "Your mouse", runs, seconds, score, you: true },
    ...REFERENCES.map((reference) => ({
      name: reference.name,
      runs: reference.runs,
      seconds: reference.seconds,
      score: finalScore(reference.runs, reference.seconds),
      you: false,
    })),
  ];

  // Scaled against the tallest bar rather than a fixed ceiling: the sliders
  // reach 2400, and a fixed axis would squash the two reference teams into
  // invisible slivers exactly when the comparison matters most.
  const peak = Math.max(...rows.map((row) => row.score ?? 0), 1);
  const ranked = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const fields = [
    {
      id: runsId,
      label: "Successful runs",
      value: runs,
      set: setRuns,
      min: 0,
      max: MAX_RUNS,
      unit: "runs",
    },
    {
      id: secondsId,
      label: "Official time",
      value: seconds,
      set: setSeconds,
      min: 5,
      max: MAX_SECONDS,
      unit: "seconds",
    },
  ] as const;

  return (
    <Figure
      id="scoring"
      title="What a run is worth"
      caption={
        <>
          Both numbers matter, which is the point of the formula. Finishing more often raises
          the score just as finishing faster does, so the ranking is not simply{" "}
          <strong>who was quickest</strong>. The rulebook&rsquo;s own example is pinned on
          screen: four runs at 25 seconds beats one run at 18.
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-start">
        <div>
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className="block text-sm font-semibold text-ras-purple dark:text-white"
                >
                  {field.label}
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    id={field.id}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={field.value}
                    onChange={(event) => field.set(Number(event.target.value))}
                    className="w-20 min-h-[44px] rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-ras-purple transition-colors focus-visible:border-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:text-white dark:focus-visible:border-white dark:focus-visible:ring-white/30"
                  />
                  <input
                    type="range"
                    aria-label={`${field.label} in ${field.unit}`}
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={field.value}
                    onChange={(event) => field.set(Number(event.target.value))}
                    className="h-11 min-w-0 flex-1 accent-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:focus-visible:ring-white/30"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* The formula with the reader's own numbers in it, set as a real
              fraction — the shape is what has to be remembered, and a
              parenthesised inline division does not have a shape. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono font-bold text-ras-purple dark:text-white">
            <div className="text-center text-sm">
              <div className="px-2 pb-1">{runs}</div>
              <div className="border-t-2 border-current px-2 pt-1">{seconds}</div>
            </div>
            <span aria-hidden="true">&times;</span>
            <span className="text-sm">{RULES.scoreMultiplier}</span>
            <span aria-hidden="true">=</span>
            <span
              className={`text-lg ${score === null ? "text-ras-gray dark:text-white/60" : ""}`}
            >
              {formatScore(score)}
            </span>
          </div>
          <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
            {score === null
              ? "A mouse that never reaches the centre has no official time, and is ranked by shortest traversable path instead."
              : `${runs} successful ${runs === 1 ? "run" : "runs"}, divided by a ${seconds} second official time.`}
          </p>
        </div>

        {/* The ranking, announced as the sliders move: the comparison is the
            point of the figure, so it cannot be a visual-only result. */}
        <div aria-live="polite">
          <p className="text-xs uppercase tracking-wide text-ras-gray dark:text-white/60">
            Ranking
          </p>
          <ol className="mt-3 space-y-3">
            {ranked.map((row) => (
              <li key={row.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`truncate text-sm ${
                      row.you
                        ? "font-bold text-ras-purple dark:text-white"
                        : "text-ras-gray dark:text-white/70"
                    }`}
                  >
                    {row.name}
                    <span className="ms-2 font-mono text-xs text-ras-gray dark:text-white/50">
                      {row.runs}/{row.seconds}s
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold ${
                      row.you
                        ? "text-ras-purple dark:text-white"
                        : "text-ras-gray dark:text-white/70"
                    }`}
                  >
                    {formatScore(row.score)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ras-purple/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none ${
                      row.you
                        ? "bg-ras-crimson dark:bg-rose-400"
                        : "bg-ras-purple/50 dark:bg-white/40"
                    }`}
                    style={{ width: `${((row.score ?? 0) / peak) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <Stat label="Your score" value={formatScore(score)} />
            <Stat
              label="Places"
              value={`${ranked.findIndex((row) => row.you) + 1} of ${ranked.length}`}
            />
          </dl>
        </div>
      </div>
    </Figure>
  );
}
