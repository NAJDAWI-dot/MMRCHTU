"use client";

import { useEffect, useRef, useState } from "react";
import { DayIcon } from "@/components/day-site/icons";
import {
  MATCH_SECONDS,
  MAZE_CELLS,
  formatPoints,
  formatTime,
  outcomeText,
  parseCell,
  parseRunTime,
  scoreSheet,
  workingOf,
  type RunEntry,
} from "@/lib/score-sheet";

type Row = { ok: boolean; time: string; cell: string };

const EMPTY: Row = { ok: true, time: "", cell: "" };

const rowOf = (run: RunEntry): Row => ({
  ok: run.ok,
  time: run.time === null ? "" : String(run.time),
  cell: run.cell === null ? "" : String(run.cell),
});

/**
 * One side's match sheet, as the judge fills it in: a row per run, each
 * marked as reaching the centre or not, a stopwatch to time one, and the score
 * worked out live underneath exactly as the server will work it out, from the
 * same code.
 *
 * A successful run takes its time. A failed one takes only the cell it
 * reached, 1 to 99 of the maze's 100. Every row posts one `${name}` (the time,
 * empty on a failed run), one `${resultName}` ("yes" or "no") and one
 * `${cellName}` (empty on a successful run), so the server can line them up; a
 * successful row with no time is ignored there, so a spare row costs nothing.
 */
export function RunTimes({
  name,
  resultName,
  cellName,
  initialLog,
  compact = false,
  label,
}: {
  name: string;
  resultName: string;
  cellName: string;
  initialLog: RunEntry[];
  compact?: boolean;
  label?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => (initialLog.length ? initialLog.map(rowOf) : [EMPTY]));
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (started === null) return;
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, [started]);

  const parsed = rows.map((row) => ({
    time: row.ok && row.time.trim() ? parseRunTime(row.time) : null,
    cell: !row.ok && row.cell.trim() ? parseCell(row.cell) : null,
  }));
  const badTime = rows.map((row, i) => row.ok && !!row.time.trim() && parsed[i]!.time === null);
  const badCell = rows.map((row, i) => !row.ok && !!row.cell.trim() && parsed[i]!.cell === null);
  // The runs as the server will read them: successful rows with a time, and every failed row.
  const log = rows.flatMap((row, i): RunEntry[] => {
    const { time, cell } = parsed[i]!;
    if (row.ok) return time !== null ? [{ ok: true, time, cell: null }] : [];
    return [{ ok: false, time: null, cell }];
  });
  const sheet = scoreSheet({ times: [], remaining: null, log });
  const total = log.reduce((sum, run) => sum + (run.time ?? 0), 0);
  const officialIndex = sheet.official === null ? -1 : rows.findIndex((row, i) => row.ok && parsed[i]!.time === sheet.official);

  const focusLast = () => window.setTimeout(() => listRef.current?.querySelector<HTMLInputElement>("li:last-child input[data-field]")?.focus(), 0);
  const addRow = (row: Row = EMPTY) => {
    setRows((current) => {
      // Fill an empty last row before adding another.
      const last = current[current.length - 1];
      if (last && last.ok && !last.time.trim()) return [...current.slice(0, -1), row];
      return [...current, row];
    });
    if (!row.time) focusLast();
  };
  const update = (index: number, change: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  const startWatch = () => {
    const t = performance.now();
    setStarted(t);
    setNow(t);
  };
  // A failed run is written down by its cell, not its time.
  const stopWatch = (ok: boolean) => {
    if (started === null) return;
    const seconds = Math.round((performance.now() - started) / 10) / 100;
    setStarted(null);
    if (!ok) addRow({ ok: false, time: "", cell: "" });
    else if (seconds > 0) addRow({ ok: true, time: String(seconds), cell: "" });
  };

  return (
    <div className="space-y-4">
      {label ? <p className="day-kicker">{label}</p> : null}
      <ol ref={listRef} className="space-y-2">
        {rows.map((row, index) => {
          const best = index === officialIndex;
          const run = `Run ${index + 1}`;
          return (
            <li key={index} className="flex items-center gap-2">
              <span className="day-num w-7 shrink-0 text-right text-xs font-bold text-day-faint">R{index + 1}</span>
              <input type="hidden" name={resultName} value={row.ok ? "yes" : "no"} />
              <div className="flex shrink-0 overflow-hidden rounded-[4px] ring-1 ring-day-line/[0.12]" role="group" aria-label={`${run} result`}>
                <button
                  type="button"
                  aria-pressed={row.ok}
                  aria-label={`${run} reached the centre`}
                  title="Reached the centre"
                  onClick={() => update(index, { ok: true })}
                  className={`grid h-11 w-10 place-items-center transition-colors ${row.ok ? "bg-day-good text-day-on-ink" : "text-day-faint hover:bg-day-good/10"}`}
                >
                  <DayIcon name="check" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-pressed={!row.ok}
                  aria-label={`${run} failed`}
                  title="Failed: did not reach the centre"
                  onClick={() => {
                    update(index, { ok: false });
                    window.setTimeout(() => listRef.current?.querySelectorAll<HTMLInputElement>("li")[index]?.querySelector<HTMLInputElement>("input[data-field=cell]")?.focus(), 0);
                  }}
                  className={`grid h-11 w-10 place-items-center transition-colors ${!row.ok ? "bg-day-live text-day-on-ink" : "text-day-faint hover:bg-day-live/10"}`}
                >
                  <DayIcon name="close" className="h-4 w-4" />
                </button>
              </div>
              {row.ok ? (
                <div className="relative min-w-0 flex-1">
                  <input type="hidden" name={cellName} value="" />
                  <input
                    name={name}
                    data-field="time"
                    value={row.time}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`${run} time`}
                    aria-invalid={badTime[index] || undefined}
                    placeholder="e.g. 25.41"
                    onChange={(event) => update(index, { time: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addRow();
                      }
                    }}
                    className={`day-input day-num ${badTime[index] || (best && !compact) ? "pr-20" : best ? "pr-8" : ""} ${badTime[index] ? "border-day-live/60" : best ? "border-day-gold/60 bg-day-gold/[0.06]" : ""}`}
                  />
                  {badTime[index] ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-day-live">Not a time</span>
                  ) : best && compact ? (
                    // Too narrow for the word: a star, and the word for screen readers.
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-day-gold" title="Official time">
                      <span aria-hidden="true">★</span>
                      <span className="sr-only">Official time</span>
                    </span>
                  ) : best ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[2px] bg-day-gold/15 px-2 py-0.5 text-[10px] font-bold text-day-gold">Official</span>
                  ) : null}
                </div>
              ) : (
                <div className="relative min-w-0 flex-1">
                  <input type="hidden" name={name} value="" />
                  <input
                    name={cellName}
                    data-field="cell"
                    value={row.cell}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`${run} cell reached`}
                    aria-invalid={badCell[index] || undefined}
                    placeholder={compact ? `Cell, 1 to ${MAZE_CELLS - 1}` : `Cell reached, 1 to ${MAZE_CELLS - 1}`}
                    onChange={(event) => update(index, { cell: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addRow();
                      }
                    }}
                    className={`day-input day-num border-day-live/40 bg-day-live/[0.05] ${compact ? "" : "pr-24"} ${badCell[index] ? "border-day-live/70" : ""}`}
                  />
                  {badCell[index] ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-day-live">1 to {MAZE_CELLS - 1}</span>
                  ) : compact ? null : (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-day-live">of {MAZE_CELLS}</span>
                  )}
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove run ${index + 1}`}
                onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [EMPTY]))}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[4px] text-day-faint transition-colors hover:bg-day-live/10 hover:text-day-live"
              >
                <DayIcon name="close" className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => addRow()} className="day-btn day-btn-soft day-btn-sm">
          <DayIcon name="plus" className="h-4 w-4" />
          Add a run
        </button>
        {started === null ? (
          <button type="button" onClick={startWatch} className="day-btn day-btn-soft day-btn-sm">
            <DayIcon name="timer" className="h-4 w-4" />
            Time a run
          </button>
        ) : (
          <>
            <button type="button" onClick={() => stopWatch(true)} className="day-btn day-btn-ink day-btn-sm" aria-live="polite">
              <DayIcon name="check" className="h-4 w-4" />
              Reached · {((now - started) / 1000).toFixed(2)} s
            </button>
            <button type="button" onClick={() => stopWatch(false)} className="day-btn day-btn-danger day-btn-sm">
              <DayIcon name="close" className="h-4 w-4" />
              Failed
            </button>
          </>
        )}
      </div>

      <div className={`rounded-[4px] bg-day-ink p-4 text-day-on-ink ${compact ? "" : "sm:p-5"}`} aria-live="polite">
        <div className={`grid gap-3 ${compact ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-3"}`}>
          <div>
            <p className="text-[11px] font-semibold opacity-60">Successful</p>
            <p className={`day-num day-display mt-1 whitespace-nowrap ${compact ? "text-xl" : "text-2xl"}`}>
              {sheet.runs}
              {sheet.failed ? <span className="opacity-60"> / {sheet.runs + sheet.failed}</span> : null}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold opacity-60">Official time</p>
            <p className={`day-num day-display mt-1 whitespace-nowrap ${compact ? "text-xl" : "text-2xl"}`}>{formatTime(sheet.official)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold opacity-60">Score</p>
            <p className={`day-num day-display mt-1 whitespace-nowrap ${compact ? "text-2xl" : "text-3xl"}`}>{formatPoints(sheet.score)}</p>
          </div>
        </div>
        <p className="day-num mt-3 border-t border-day-on-ink/20 pt-3 text-xs opacity-75">
          {sheet.runs + sheet.failed ? `${outcomeText(sheet)}. ` : ""}
          {workingOf(sheet)}
          {total > MATCH_SECONDS ? " These add up to more than 8 minutes." : ""}
        </p>
      </div>
    </div>
  );
}

/** The eight minutes, counted down, for whoever is watching the maze. */
export function MatchClock() {
  const [left, setLeft] = useState(MATCH_SECONDS * 1000);
  const [running, setRunning] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    if (!running) return;
    last.current = performance.now();
    const timer = window.setInterval(() => {
      const t = performance.now();
      setLeft((value) => Math.max(0, value - (t - last.current)));
      last.current = t;
    }, 100);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (left === 0) setRunning(false);
  }, [left]);

  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const low = left < 60000;
  return (
    <div className="flex items-center gap-3 rounded-[4px] bg-day-sunk px-4 py-2.5 ring-1 ring-day-line/[0.07]">
      <DayIcon name="timer" className={`h-5 w-5 ${low ? "text-day-live" : "text-day-muted"}`} />
      <span className={`day-num day-display text-2xl ${low ? "text-day-live" : "text-day-ink"}`} aria-label="Match time left">
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
      <button type="button" onClick={() => setRunning((value) => !value)} className="day-btn day-btn-ink day-btn-sm" disabled={left === 0}>
        {running ? "Pause" : left === MATCH_SECONDS * 1000 ? "Start 8 min" : "Resume"}
      </button>
      <button
        type="button"
        onClick={() => {
          setRunning(false);
          setLeft(MATCH_SECONDS * 1000);
        }}
        className="day-btn day-btn-soft day-btn-sm"
      >
        Reset
      </button>
    </div>
  );
}
