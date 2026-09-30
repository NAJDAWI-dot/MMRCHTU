"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { DAY_TIME_ZONE } from "@/lib/day-mode";
import { DeskForm, Submit } from "../hq/DeskKit";
import { resetTimes, setTeamTime, shiftTimes } from "../hq/scoring/actions";

export interface DrawCell {
  id: string;
  order: number;
  name: string;
  code: string;
  /** "09:40", or "" before a start time is set. */
  slot: string;
  /** Minutes away from where the draw put it: +15 after a break, 0 when on time. */
  shift: number;
  state: "now" | "next" | "after" | "ran" | "waiting" | "out";
}

/** How many columns the board takes, so every team fits one screen without scrolling. */
function columnsFor(count: number): number {
  if (count <= 8) return 1;
  if (count <= 18) return 2;
  if (count <= 33) return 3;
  if (count <= 52) return 4;
  return 5;
}

const TAG: Record<DrawCell["state"], string> = {
  now: "On the maze",
  next: "Next",
  after: "After that",
  ran: "Ran",
  waiting: "",
  out: "Not running",
};

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: DAY_TIME_ZONE }).format(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="day-num day-display text-[clamp(1.75rem,5vh,3.5rem)] leading-none text-day-ink">{now || " "}</span>;
}

function Cell({ cell, index, crest }: { cell: DrawCell; index: number; crest: number | null }) {
  const live = cell.state === "now";
  const soon = cell.state === "next" || cell.state === "after";
  return (
    <li
      className={`day-draw-cell ${live ? "day-draw-now day-floor" : soon ? "day-draw-soon" : ""} ${cell.state === "ran" ? "day-draw-ran" : ""} ${cell.state === "out" ? "day-draw-out" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="day-draw-order day-num">{String(cell.order).padStart(2, "0")}</span>
      {crest ? (
        <span className="day-draw-crest" aria-hidden="true">
          <Crest name={cell.name} size={crest} ring={live} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {cell.code || TAG[cell.state] ? (
          <span className="day-draw-meta">
            {cell.code ? <span className="day-draw-code day-num">{cell.code}</span> : null}
            {TAG[cell.state] ? (
              <span className={`day-draw-tag ${live ? "text-day-live" : soon ? "text-day-crimson" : "text-day-faint"}`}>
                {live ? <span className="day-live-dot" aria-hidden="true" /> : cell.state === "ran" ? <DayIcon name="check" className="h-[1em] w-[1em]" /> : null}
                {TAG[cell.state]}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="day-draw-name day-display" title={cell.name}>
          {cell.name}
        </span>
      </span>
      <span className="day-draw-time day-num">
        {cell.slot || "–"}
        {cell.shift ? <span className="day-draw-shift">{cell.shift > 0 ? `+${cell.shift}` : cell.shift}</span> : null}
      </span>
    </li>
  );
}

/** The times panel: move everyone from a place on, move one team, or put the draw's times back. */
function TimesPanel({ cells, shifted, onClose }: { cells: DrawCell[]; shifted: number; onClose: () => void }) {
  const upcoming = cells.find((cell) => cell.state === "next" || cell.state === "waiting");
  return (
    <div className="day-dialog fixed inset-x-3 bottom-3 z-30 max-h-[85dvh] overflow-y-auto border border-day-line/[0.12] bg-day-surface p-5 shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[30rem]" role="dialog" aria-label="Move the times">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="day-kicker">Times</p>
          <h2 className="day-display mt-1 text-2xl text-day-ink">Move the schedule</h2>
          <p className="mt-1 text-sm text-day-muted">Changes show here, on the hall screen, in the queue and on every team page.</p>
        </div>
        <button type="button" onClick={onClose} className="day-btn day-btn-soft day-btn-sm" aria-label="Close">
          <DayIcon name="close" className="h-4 w-4" />
        </button>
      </div>

      <DeskForm action={shiftTimes} className="mt-5 space-y-3 border-t border-day-line/[0.08] pt-5">
        <p className="font-semibold text-day-ink">Everyone from a place on</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="day-label" htmlFor="shift-from">
              From #
            </label>
            <input id="shift-from" name="from" type="number" min={1} max={cells.length} defaultValue={upcoming?.order ?? 1} className="day-input day-num w-24" />
          </div>
          <div>
            <label className="day-label" htmlFor="shift-min">
              Minutes (− for earlier)
            </label>
            <input id="shift-min" name="minutes" type="number" min={-180} max={180} defaultValue={10} className="day-input day-num w-28" />
          </div>
          <Submit pending="Moving…">Move</Submit>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[5, 10, 15, 30].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="day-btn day-btn-soft day-btn-sm day-num"
              onClick={(event) => {
                const input = event.currentTarget.form?.elements.namedItem("minutes") as HTMLInputElement | null;
                if (input) input.value = String(minutes);
              }}
            >
              +{minutes}
            </button>
          ))}
        </div>
      </DeskForm>

      <DeskForm action={setTeamTime} className="mt-5 space-y-3 border-t border-day-line/[0.08] pt-5">
        <p className="font-semibold text-day-ink">One team</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="day-label" htmlFor="one-team">
              Team
            </label>
            <select id="one-team" name="teamId" className="day-input" defaultValue="">
              <option value="" disabled>
                Pick a team
              </option>
              {cells.map((cell) => (
                <option key={cell.id} value={cell.id}>
                  #{cell.order} {cell.code ? `${cell.code} ` : ""}
                  {cell.name} · {cell.slot || "no time"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="day-label" htmlFor="one-time">
              New time
            </label>
            <input id="one-time" name="time" placeholder="10:40" className="day-input day-num w-24" />
          </div>
          <Submit pending="Saving…" variant="secondary">
            Set
          </Submit>
        </div>
      </DeskForm>

      <DeskForm action={resetTimes} className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-day-line/[0.08] pt-5">
        <p className="text-sm text-day-muted">{shifted ? `${shifted} team${shifted === 1 ? " is" : "s are"} off the drawn times.` : "Every team is on its drawn time."}</p>
        <Submit pending="…" variant="ghost" size="sm">
          Back to the drawn times
        </Submit>
      </DeskForm>
    </div>
  );
}

/**
 * The draw on a big screen. Every team fits one screen: the columns follow
 * the number of teams and the type follows the rows. Deals in once, in order,
 * when it opens. F for full screen, T for the times panel.
 */
export function DrawBoard({
  cells,
  start,
  slotMinutes,
  locked,
  shifted,
}: {
  cells: DrawCell[];
  start: string;
  slotMinutes: number;
  locked: boolean;
  shifted: number;
}) {
  const [panel, setPanel] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "f" || event.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      }
      if ((event.key === "t" || event.key === "T") && !locked) setPanel((open) => !open);
      if (event.key === "Escape") setPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked]);

  const columns = columnsFor(cells.length);
  const rows = Math.max(1, Math.ceil(cells.length / columns));
  const ran = cells.filter((cell) => cell.state === "ran").length;
  // The crest sets its own size, so it is picked to suit a row.
  // Past three columns the names need the room more than the crests do.
  const crest = columns >= 4 ? null : rows <= 6 ? 48 : rows <= 9 ? 36 : rows <= 12 ? 28 : 22;

  return (
    <main className="day-draw flex min-h-[100dvh] flex-col gap-[2.5vh] px-[3vw] py-[3vh]">
      <DayAutoRefresh />
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-day-line/85 pb-[1.5vh]">
        <div>
          <p className="day-kicker">Phase 1 · Qualifying</p>
          <h1 className="day-display text-[clamp(2rem,6.5vh,4.75rem)] leading-[0.95] text-day-ink">The running order</h1>
        </div>
        <div className="flex flex-wrap items-end gap-[3vw]">
          <p className="day-num text-right text-[clamp(0.9rem,2vh,1.25rem)] font-semibold text-day-muted">
            {cells.length} teams{start ? ` · from ${start} · every ${slotMinutes} min` : ""}
            <br />
            {ran} of {cells.length} have run
          </p>
          <Clock />
        </div>
      </header>

      {cells.length ? (
        <ol
          className="day-draw-grid flex-1"
          style={{ "--cols": columns, "--rows": rows } as CSSProperties}
          aria-label="The running order"
        >
          {cells.map((cell, index) => (
            <Cell key={cell.id} cell={cell} index={index} crest={crest} />
          ))}
        </ol>
      ) : (
        <div className="day-card grid flex-1 place-items-center p-10 text-center">
          <div>
            <p className="day-display text-4xl text-day-ink">Not drawn yet</p>
            <p className="mt-2 text-day-muted">Draw the order on the Qualifying desk and it appears here.</p>
          </div>
        </div>
      )}

      <footer className="day-draw-foot flex flex-wrap items-center justify-between gap-3 text-sm text-day-faint">
        <span>F full screen{locked ? "" : " · T move the times"}</span>
        <span className="flex gap-2">
          {locked ? null : (
            <button type="button" onClick={() => setPanel((open) => !open)} className="day-btn day-btn-ink day-btn-sm">
              <DayIcon name="timer" className="h-4 w-4" />
              Times
            </button>
          )}
          <Link href="/day/hq/scoring" className="day-btn day-btn-soft day-btn-sm">
            Back to the desk
          </Link>
        </span>
      </footer>

      {panel && !locked ? <TimesPanel cells={cells} shifted={shifted} onClose={() => setPanel(false)} /> : null}
    </main>
  );
}
