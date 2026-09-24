"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { DayIcon } from "@/components/day-site/icons";
import { MMRC_PLATE } from "@/lib/brand";
import { DAY_TIME_ZONE } from "@/lib/day-mode";

export interface ScreenPanel {
  key: string;
  label: string;
  node: ReactNode;
}

export interface ScreenAlert {
  title: string;
  body: string;
  tone: "INFO" | "URGENT" | "GOOD";
}

/** Seconds on each panel; "now" holds a little longer, it is what people look up for. */
const DWELL = { now: 16, other: 11 };

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Nothing until mounted: the server's clock and the hall's would disagree by a render.
  if (!now) return <span className="day-num day-display text-[5.5vh] text-day-ink">&nbsp;</span>;
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DAY_TIME_ZONE,
  }).format(now);
  return (
    <time className="day-num day-display text-[5.5vh] leading-none text-day-ink" dateTime={now.toISOString()}>
      {time}
    </time>
  );
}

/**
 * The hall screen's frame: the header, one panel at a time, and the alert
 * strip along the bottom.
 *
 * The panels are drawn on the server; this only decides which one shows. "Now"
 * comes back between every other panel, so whoever glances up sees who is on
 * the maze within a few seconds. Arrow keys step through, space pauses, F goes
 * full screen. The cursor hides when the mouse is left alone.
 */
export function HallScreen({
  panels,
  phaseLine,
  alert,
  followUrl,
}: {
  panels: ScreenPanel[];
  phaseLine: string;
  alert: ScreenAlert | null;
  followUrl: string;
}) {
  // Read here rather than on the server: once the day site is public the page
  // is served from the cache, which never sees the query string.
  // ?panel=standings holds one panel; ?theme=light suits a screen in a bright room.
  const [pinned, setPinned] = useState<string | null>(null);
  const [light, setLight] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setPinned(query.get("panel"));
    setLight(query.get("theme") === "light");
  }, []);

  // now, a, now, b, now, c: "now" between each of the others.
  const sequence = useMemo(() => {
    const now = panels.find((panel) => panel.key === "now");
    const others = panels.filter((panel) => panel.key !== "now");
    if (!now) return others;
    if (!others.length) return [now];
    return others.flatMap((panel) => [now, panel]);
  }, [panels]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [full, setFull] = useState(false);

  const pinnedIndex = pinned ? sequence.findIndex((panel) => panel.key === pinned) : -1;
  const at = pinnedIndex >= 0 ? pinnedIndex : index % Math.max(1, sequence.length);
  const current = sequence[at];
  const dwell = (current?.key === "now" ? DWELL.now : DWELL.other) * 1000;
  const holding = paused || pinnedIndex >= 0 || sequence.length < 2;

  const step = useCallback((delta: number) => setIndex((value) => (value + delta + sequence.length) % Math.max(1, sequence.length)), [sequence.length]);

  // A refresh can add or drop panels; keep the index inside the new list.
  useEffect(() => {
    if (index >= sequence.length) setIndex(0);
  }, [index, sequence.length]);

  useEffect(() => {
    if (holding) return;
    const timer = setTimeout(() => step(1), dwell);
    return () => clearTimeout(timer);
  }, [at, dwell, holding, step]);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key === "f" || event.key === "F") toggleFull();
    };
    const onFull = () => setFull(!!document.fullscreenElement);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    onMove();
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("mousemove", onMove);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("mousemove", onMove);
    };
  }, [step, toggleFull]);

  // On-ink reads on every tone in both themes; plain white on the dark theme's bright pink does not.
  const alertTone = alert?.tone === "URGENT" ? "bg-day-live text-day-on-ink" : alert?.tone === "GOOD" ? "bg-day-good text-day-on-ink" : "bg-day-ink text-day-on-ink";

  return (
    // Over the day shell, in the dark theme unless asked: a dark screen reads
    // better in a lit hall and does not glare in a dim one.
    <div className={light ? "" : "dark"}>
      <div className="day-root h-dvh overflow-hidden" style={{ position: "fixed", inset: 0, zIndex: 60 }}>
        <div className="day-checker pointer-events-none absolute inset-x-0 top-0 h-[1.2vh] opacity-[0.12]" aria-hidden="true" />
        <div className={`grid h-full grid-rows-[auto_minmax(0,1fr)_auto] ${idle ? "cursor-none" : ""}`}>
          <DayAutoRefresh />

          {/* ---------------------------------------------------------- header */}
          <header className="flex items-center justify-between gap-[3vh] px-[4vh] pb-[1.5vh] pt-[3vh]">
            <div className="flex min-w-0 items-center gap-[2vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo/mmrc-mark.png" alt="" className="h-[7vh] w-[7vh] rounded-[1.4vh] object-contain p-[0.8vh]" style={{ backgroundColor: MMRC_PLATE }} />
              <div className="min-w-0 leading-none">
                <p className="font-brand text-[4.2vh] text-day-ink">MMRC 26</p>
                <p className="day-kicker mt-[0.8vh] truncate text-[1.6vh]">Competition day</p>
              </div>
            </div>
            <p className="flex min-w-0 items-center gap-[1.2vh] truncate text-[2.6vh] font-semibold text-day-ink">
              <span className="day-live-dot shrink-0" aria-hidden="true" />
              {phaseLine}
            </p>
            <div className="flex items-center gap-[2vh]">
              <button
                type="button"
                onClick={toggleFull}
                className={`day-btn day-btn-soft day-btn-sm transition-opacity ${idle || full ? "pointer-events-none opacity-0" : "opacity-100"}`}
                aria-label={full ? "Leave full screen" : "Full screen"}
              >
                <DayIcon name="expand" className="h-4 w-4" />
                {full ? "Exit" : "Full screen"}
              </button>
              <Clock />
            </div>
          </header>

          {/* ----------------------------------------------------------- panel */}
          <main className="relative min-h-0 px-[4vh] py-[2vh]">
            {current ? (
              <section key={`${current.key}-${at}`} aria-label={current.label} className="screen-panel h-full">
                {current.node}
              </section>
            ) : null}
          </main>

          {/* ---------------------------------------------------------- footer */}
          <footer>
            {alert ? (
              <div className={`flex items-center gap-[2vh] px-[4vh] py-[1.8vh] ${alertTone}`} role="status">
                <DayIcon name="megaphone" className="h-[3.4vh] w-[3.4vh] shrink-0" />
                <p className="min-w-0 truncate text-[2.8vh] font-semibold">
                  {alert.title ? <span className="mr-[1.5vh]">{alert.title}</span> : null}
                  <span className="font-normal opacity-90">{alert.body}</span>
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-[3vh] px-[4vh] py-[1.8vh]">
              <p className="text-[2vh] text-day-muted">
                Follow along on your phone: <span className="font-semibold text-day-ink">{followUrl}</span>
              </p>
              <ol className="flex items-center gap-[1vh]" aria-label="Panels">
                {panels.map((panel) => (
                  <li key={panel.key}>
                    <button
                      type="button"
                      onClick={() =>
                        setIndex(
                          Math.max(
                            0,
                            sequence.findIndex((item) => item.key === panel.key),
                          ),
                        )
                      }
                      aria-current={panel.key === current?.key ? "true" : undefined}
                      className={`rounded-full px-[1.4vh] py-[0.5vh] text-[1.6vh] font-semibold transition-colors ${
                        panel.key === current?.key ? "bg-day-ink text-day-on-ink" : "text-day-faint hover:text-day-ink"
                      }`}
                    >
                      {panel.label}
                    </button>
                  </li>
                ))}
                {holding && sequence.length > 1 ? <li className="text-[1.6vh] font-semibold text-day-faint">· held</li> : null}
              </ol>
            </div>
            {/* How long until the next panel. */}
            <div className="h-[0.6vh] bg-day-ink/10" aria-hidden="true">
              {holding ? null : <div key={`${at}-${index}`} className="screen-progress h-full bg-day-crimson" style={{ animationDuration: `${dwell}ms` }} />}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
