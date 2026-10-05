"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Crest } from "@/components/day-site/Crest";

export interface CalledTeam {
  name: string;
  code: string;
  runOrder: number | null;
  /** The maze it runs on, or "". */
  maze: string;
}

export interface ScreenCall {
  /** The teams and the moment they were called, so each call plays once. */
  key: string;
  /** One team per maze: two when the mazes run side by side. */
  teams: CalledTeam[];
  /** ISO time of the call. */
  calledAt: string;
  next: { name: string; code: string }[];
  then: { name: string; code: string }[];
}

const STORE = "mmrc26-day-call";
/** How long a call holds the screen. */
const HOLD_MS = 9000;
/** A call older than this when the screen first sees it is not news any more. */
const STALE_MS = 3 * 60_000;

const label = (team: { name: string; code: string }) => (team.code ? `${team.code} ${team.name}` : team.name);
const labels = (teams: { name: string; code: string }[]) => teams.map(label).join(" and ");

/**
 * Teams called to the mazes, on the hall screen: the whole screen for nine
 * seconds, then back to the panels. One team takes the middle; two, called
 * together for the two mazes, stand side by side, each with its own maze.
 * Plays once per call on each screen, and only while the call is fresh, so a
 * screen switched on mid-afternoon does not replay the last one. ?call=again
 * replays it, to rehearse.
 *
 * The call is announced to assistive technology as it appears. With reduced
 * motion it simply appears and goes.
 */
export function CallTakeover({ call }: { call: ScreenCall | null }) {
  const [shown, setShown] = useState<ScreenCall | null>(null);
  // The screen refreshes every few seconds and hands over a new object each
  // time; only a new call, not a new render, may start or stop one.
  const key = call?.key ?? null;

  useEffect(() => {
    if (!call) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(STORE);
      localStorage.setItem(STORE, call.key);
    } catch {}
    const again = new URLSearchParams(window.location.search).get("call") === "again";
    const fresh = Date.now() - new Date(call.calledAt).getTime() < STALE_MS;
    if (!again && (seen === call.key || !fresh)) return;
    setShown(call);
    const timer = setTimeout(() => setShown(null), HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the call itself, see above
  }, [key]);

  if (!shown || !shown.teams.length) return null;
  const pair = shown.teams.length > 1;
  const orders = shown.teams.map((team) => team.runOrder).filter((order): order is number => order !== null);
  return (
    <div className="day-call day-floor" role="status" aria-live="assertive" style={{ "--hold": `${HOLD_MS}ms` } as CSSProperties}>
      <div className="day-call-walls" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>
      <div className="day-call-body">
        <p className="day-call-kicker">
          <span className="day-live-dot" aria-hidden="true" />
          Now calling{orders.length ? ` · ${orders.map((order) => `#${order}`).join(" and ")}` : ""}
        </p>
        <div className={pair ? "day-call-pair" : "contents"}>
          {shown.teams.map((team) => (
            <div key={`${team.name}-${team.maze}`} className="day-call-team">
              <div className="day-call-crest">
                <Crest name={team.name} size={pair ? 120 : 170} ring />
              </div>
              {team.code ? <p className="day-call-code day-num">{team.code}</p> : null}
              <h1 className={`day-call-name day-display ${pair ? "day-call-name-pair" : ""}`}>
                <span>{team.name}</span>
              </h1>
              <p className="day-call-to">
                <span className="day-call-route" aria-hidden="true" />
                {team.maze ? `to ${team.maze}` : "to the maze"}
              </p>
            </div>
          ))}
        </div>
        {shown.next.length ? (
          <p className="day-call-next">
            <span>Get ready</span> {labels(shown.next)}
            {shown.then.length ? (
              <>
                <span className="mx-[1.2vw] text-day-faint">·</span>
                <span>Then</span> {labels(shown.then)}
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="day-call-timer" aria-hidden="true" />
    </div>
  );
}
