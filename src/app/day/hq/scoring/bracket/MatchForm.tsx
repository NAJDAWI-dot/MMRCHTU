"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { formatPoints, formatTime, scoreSheet } from "@/lib/score-sheet";
import { Notice, Submit } from "../../DeskKit";
import { EMPTY_DESK_STATE } from "../../state";
import { saveMatch } from "../actions";
import { RunTimes } from "../RunTimes";

export interface MatchRow {
  id: string;
  round: number;
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  teamA: string;
  teamB: string;
  seedA: number | null;
  seedB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  timesA: number[];
  timesB: number[];
  remainingA: number | null;
  remainingB: number | null;
  winnerId: string | null;
  status: string;
  arena: string;
  walkover: boolean;
  void: boolean;
  tied: boolean;
}

function Side({ name, id, seed, score, times, remaining, winner }: { name: string; id: string | null; seed: number | null; score: number | null; times: number[]; remaining: number | null; winner: boolean }) {
  const official = scoreSheet({ times, remaining }).official;
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${winner ? "bg-day-good/10" : ""}`}>
      <span className="day-num w-6 shrink-0 text-right text-xs text-day-faint">{seed ?? ""}</span>
      {id ? <Crest name={name} size={22} /> : <span className="h-[30px] w-[30px] shrink-0 rounded-[28%] border border-dashed border-day-line/20" />}
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-semibold ${id ? "text-day-ink" : "italic text-day-faint"}`}>{name}</span>
        {times.length ? (
          <span className="day-num block text-[11px] text-day-muted">
            {times.length} run{times.length === 1 ? "" : "s"} · best {formatTime(official)}
          </span>
        ) : remaining !== null ? (
          <span className="block text-[11px] text-day-muted">{remaining} cells short</span>
        ) : null}
      </span>
      {winner ? <DayIcon name="check" className="h-4 w-4 text-day-good" /> : null}
      <span className="day-num day-display w-14 text-right text-xl text-day-ink">{score !== null ? formatPoints(score) : ""}</span>
    </div>
  );
}

/**
 * One match on the Bracket desk: a scoreboard line when closed, both teams'
 * match sheets side by side when open. The winner is worked out from the
 * sheets; the pick is only for a dead heat or a match that was never run.
 */
export function MatchForm({ match }: { match: MatchRow }) {
  const [state, action] = useFormState(saveMatch, EMPTY_DESK_STATE);
  const ready = !!match.teamAId && !!match.teamBId;
  const done = !!match.winnerId;
  const live = match.status === "LIVE";
  const [open, setOpen] = useState(false);

  return (
    <div className={`day-card overflow-hidden ${live ? "ring-2 ring-day-live/50" : ""}`}>
      <div className="flex items-center justify-between border-b border-day-line/[0.07] px-4 py-2.5 text-xs font-semibold">
        <span className="flex items-center gap-2 text-day-muted">
          {live ? <span className="day-live-dot" aria-hidden="true" /> : null}
          {match.label}
          {match.arena ? <span className="text-day-faint">· {match.arena}</span> : null}
        </span>
        <span className={done ? "text-day-good" : live ? "text-day-live" : "text-day-faint"}>
          {match.void ? "No match" : match.walkover ? "Bye" : done ? "Done" : live ? "On the maze" : ready ? "Ready" : "Waiting for teams"}
        </span>
      </div>
      <div className="p-2">
        <Side name={match.teamA} id={match.teamAId} seed={match.seedA} score={match.scoreA} times={match.timesA} remaining={match.remainingA} winner={done && match.winnerId === match.teamAId} />
        <Side name={match.teamB} id={match.teamBId} seed={match.seedB} score={match.scoreB} times={match.timesB} remaining={match.remainingB} winner={done && match.winnerId === match.teamBId} />
      </div>

      {ready ? (
        open ? (
          <form action={action} className="day-dialog space-y-5 border-t border-day-line/[0.07] bg-day-sunk/40 p-4 sm:p-5">
            <input type="hidden" name="id" value={match.id} />
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
              <RunTimes name="timesA" remainingName="remainingA" initialTimes={match.timesA} initialRemaining={match.remainingA} label={match.teamA} compact />
              <RunTimes name="timesB" remainingName="remainingB" initialTimes={match.timesB} initialRemaining={match.remainingB} label={match.teamB} compact />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
              <div>
                <label className="day-label" htmlFor={`w-${match.id}`}>
                  Winner
                </label>
                <select id={`w-${match.id}`} name="winnerId" defaultValue={match.winnerId ?? ""} className="day-input">
                  <option value="">From the sheets</option>
                  <option value={match.teamAId!}>{match.teamA}</option>
                  <option value={match.teamBId!}>{match.teamB}</option>
                </select>
              </div>
              <div>
                <label className="day-label" htmlFor={`s-${match.id}`}>
                  Status
                </label>
                <select id={`s-${match.id}`} name="status" defaultValue={live ? "LIVE" : "PENDING"} className="day-input">
                  <option value="PENDING">Waiting</option>
                  <option value="LIVE">On the maze now</option>
                </select>
              </div>
              <div>
                <label className="day-label" htmlFor={`a-${match.id}`}>
                  Maze
                </label>
                <input id={`a-${match.id}`} name="arena" defaultValue={match.arena} placeholder="Maze A" className="day-input" />
              </div>
            </div>
            <p className="text-xs text-day-muted">
              The winner is worked out from the sheets. Pick one only for a dead heat, or a match one team did not turn up for.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-day-muted">
                <input type="checkbox" name="clearLater" value="yes" className="h-4 w-4" />
                Clear later results if this changes them
              </label>
              <div className="flex gap-2">
                <button type="button" className="day-btn day-btn-soft day-btn-sm" onClick={() => setOpen(false)}>
                  Close
                </button>
                <Submit pending="Saving…" size="sm">
                  Save result
                </Submit>
              </div>
            </div>
            <Notice state={state} />
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3 border-t border-day-line/[0.07] px-4 py-3">
            {match.tied && !match.winnerId ? <p className="text-xs font-semibold text-day-live">Level: pick the winner.</p> : <span />}
            <button type="button" className={`day-btn day-btn-sm ${done ? "day-btn-soft" : "day-btn-ink"}`} onClick={() => setOpen(true)}>
              {done ? "Edit result" : "Enter result"}
            </button>
          </div>
        )
      ) : null}
      {!open ? (
        <div className="px-4 pb-3 empty:hidden">
          <Notice state={state} />
        </div>
      ) : null}
    </div>
  );
}
