"use client";

import { useEffect, useRef, useState } from "react";
import { DayIcon } from "@/components/day-site/icons";
import { MATCH_SECONDS, formatPoints, formatTime, parseRunTime, scoreSheet, workingOf } from "@/lib/score-sheet";

/**
 * One side's match sheet, as the judge fills it in: a row per run that
 * reached the centre, a stopwatch to time one, and the score worked out live
 * underneath exactly as the server will work it out, from the same code.
 *
 * Posts every row as `${name}` and the distance short as `${remainingName}`;
 * blank rows are ignored on the server, so a spare row costs nothing.
 */
export function RunTimes({
  name,
  remainingName,
  initialTimes,
  initialRemaining,
  compact = false,
  label,
}: {
  name: string;
  remainingName: string;
  initialTimes: number[];
  initialRemaining: number | null;
  compact?: boolean;
  label?: string;
}) {
  const [rows, setRows] = useState<string[]>(() => (initialTimes.length ? initialTimes.map(String) : [""]));
  const [remaining, setRemaining] = useState(initialRemaining === null ? "" : String(initialRemaining));
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (started === null) return;
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, [started]);

  const parsed = rows.map((row) => (row.trim() ? parseRunTime(row) : null));
  const bad = rows.map((row, i) => !!row.trim() && parsed[i] === null);
  const times = parsed.filter((time): time is number => time !== null);
  const sheet = scoreSheet({ times, remaining: remaining.trim() ? Number(remaining.replace(",", ".")) : null });
  const total = times.reduce((sum, time) => sum + time, 0);

  const focusLast = () => window.setTimeout(() => listRef.current?.querySelector<HTMLInputElement>("li:last-child input")?.focus(), 0);
  const addRow = (value = "") => {
    setRows((current) => {
      // Fill an empty last row before adding another.
      if (current.length && !current[current.length - 1]!.trim()) return [...current.slice(0, -1), value];
      return [...current, value];
    });
    if (!value) focusLast();
  };

  const stopwatch = () => {
    if (started === null) {
      const t = performance.now();
      setStarted(t);
      setNow(t);
      return;
    }
    const seconds = Math.round((performance.now() - started) / 10) / 100;
    setStarted(null);
    if (seconds > 0) addRow(String(seconds));
  };

  return (
    <div className="space-y-4">
      {label ? <p className="day-kicker">{label}</p> : null}
      <ol ref={listRef} className="space-y-2">
        {rows.map((row, index) => {
          const best = sheet.official !== null && parsed[index] === sheet.official && parsed.indexOf(sheet.official) === index;
          return (
            <li key={index} className="flex items-center gap-2">
              <span className="day-num w-9 shrink-0 text-right text-xs font-bold text-day-faint">R{index + 1}</span>
              <div className="relative flex-1">
                <input
                  name={name}
                  value={row}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`Run ${index + 1} time`}
                  aria-invalid={bad[index] || undefined}
                  placeholder="Seconds, e.g. 25.41"
                  onChange={(event) => setRows((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addRow();
                    }
                  }}
                  className={`day-input day-num pr-20 ${bad[index] ? "border-day-live/60" : best ? "border-day-gold/60 bg-day-gold/[0.06]" : ""}`}
                />
                {best ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-day-gold/15 px-2 py-0.5 text-[10px] font-bold text-day-gold">Official</span>
                ) : bad[index] ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-day-live">Not a time</span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Remove run ${index + 1}`}
                onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [""]))}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-day-faint transition-colors hover:bg-day-live/10 hover:text-day-live"
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
        <button
          type="button"
          onClick={stopwatch}
          className={`day-btn day-btn-sm ${started !== null ? "day-btn-danger" : "day-btn-soft"}`}
          aria-live="polite"
        >
          <DayIcon name="timer" className="h-4 w-4" />
          {started !== null ? `Stop · ${((now - started) / 1000).toFixed(2)} s` : "Time a run"}
        </button>
      </div>

      {sheet.runs === 0 ? (
        <div>
          <label className="day-label" htmlFor={`${remainingName}-field`}>
            No run reached the centre? Cells short of it at best
          </label>
          <input
            id={`${remainingName}-field`}
            name={remainingName}
            value={remaining}
            onChange={(event) => setRemaining(event.target.value)}
            inputMode="decimal"
            placeholder="e.g. 3"
            className="day-input day-num max-w-[10rem]"
          />
        </div>
      ) : (
        <input type="hidden" name={remainingName} value="" />
      )}

      <div className={`rounded-2xl bg-day-ink p-4 text-day-on-ink ${compact ? "" : "sm:p-5"}`} aria-live="polite">
        <div className={`grid gap-3 ${compact ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-3"}`}>
          <div>
            <p className="text-[11px] font-semibold opacity-60">Runs</p>
            <p className={`day-num day-display mt-1 whitespace-nowrap ${compact ? "text-xl" : "text-2xl"}`}>{sheet.runs}</p>
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
          {workingOf(sheet)}
          {total > MATCH_SECONDS ? " · These add up to more than 8 minutes." : ""}
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
    <div className="flex items-center gap-3 rounded-2xl bg-day-sunk px-4 py-2.5 ring-1 ring-day-line/[0.07]">
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
