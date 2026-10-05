"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { shareOut } from "@/lib/mazes";
import { Notice, Submit } from "../../DeskKit";
import { EMPTY_DESK_STATE } from "../../state";
import { saveQualifyingMazes, saveSchedule } from "./actions";

/** A maze picker, keeping a name that is no longer on the list so saving does not drop it. */
function MazeSelect({ value, mazes, onChange, label, name }: { value: string; mazes: string[]; onChange: (value: string) => void; label: string; name: string }) {
  const options = [...new Set([...mazes, value].filter(Boolean))];
  return (
    <select name={name} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="day-input h-11 min-w-0">
      <option value="">Not set</option>
      {options.map((maze) => (
        <option key={maze} value={maze}>
          {maze}
        </option>
      ))}
    </select>
  );
}

export interface QualifyingTeam {
  id: string;
  name: string;
  code: string;
  runOrder: number | null;
  maze: string;
}

/** Phase 1: every team on a maze, in running order. */
export function QualifyingMazes({ teams, mazes }: { teams: QualifyingTeam[]; mazes: string[] }) {
  const [state, action] = useFormState(saveQualifyingMazes, EMPTY_DESK_STATE);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(teams.map((team) => [team.id, team.maze])));
  const setAll = (maze: string) => setValues(Object.fromEntries(teams.map((team) => [team.id, maze])));
  const share = () => setValues(Object.fromEntries(shareOut(teams.map((team) => team.id), mazes)));

  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {mazes.length > 1 ? (
          <button type="button" onClick={share} className="day-btn day-btn-soft day-btn-sm">
            Share out in turn
          </button>
        ) : null}
        {mazes.map((maze) => (
          <button key={maze} type="button" onClick={() => setAll(maze)} className="day-btn day-btn-soft day-btn-sm">
            Everyone on {maze}
          </button>
        ))}
        <button type="button" onClick={() => setAll("")} className="day-btn day-btn-soft day-btn-sm">
          Clear
        </button>
      </div>
      <ol className="day-card divide-y divide-day-line/[0.07]">
        {teams.map((team) => (
          <li key={team.id} className="flex items-center gap-3 px-4 py-2.5">
            <input type="hidden" name="teamId" value={team.id} />
            <span className="day-num w-8 shrink-0 text-right text-xs font-bold text-day-faint">{team.runOrder ? `#${team.runOrder}` : ""}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-day-ink">
                {team.code ? <span className="day-num mr-2 bg-day-ink px-1 text-xs font-extrabold text-day-on-ink">{team.code}</span> : null}
                {team.name}
              </span>
            </span>
            <span className="w-40 shrink-0 sm:w-48">
              <MazeSelect
                name="maze"
                value={values[team.id] ?? ""}
                mazes={mazes}
                label={`Maze for ${team.name}`}
                onChange={(maze) => setValues((current) => ({ ...current, [team.id]: maze }))}
              />
            </span>
          </li>
        ))}
      </ol>
      <div className="flex justify-end">
        <Submit pending="Saving…">Save qualifying mazes</Submit>
      </div>
      <Notice state={state} />
    </form>
  );
}

export interface ScheduleRow {
  id: string;
  /** "Round of 16", the heading the row sits under. */
  round: string;
  /** "Match 3", or "" for a round of one. */
  label: string;
  teamA: string;
  teamB: string;
  /** "14:20", or "" for no time yet. */
  time: string;
  maze: string;
  played: boolean;
}

/**
 * Every knockout match's time and maze, by hand. One maze a match: both teams
 * of a match take their turns on it, while the match beside it uses the other.
 */
export function MatchSchedule({ rows, mazes }: { rows: ScheduleRow[]; mazes: string[] }) {
  const [state, action] = useFormState(saveSchedule, EMPTY_DESK_STATE);
  const [mazeOf, setMazeOf] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [row.id, row.maze])));
  const [timeOf, setTimeOf] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [row.id, row.time])));
  // New times from the server (the automatic timing, another desk) replace
  // what is on screen; the table itself stays, and so does its saved notice.
  const saved = rows.map((row) => `${row.id}:${row.time}:${row.maze}`).join(",");
  useEffect(() => {
    setMazeOf(Object.fromEntries(rows.map((row) => [row.id, row.maze])));
    setTimeOf(Object.fromEntries(rows.map((row) => [row.id, row.time])));
    // Only when what is saved changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  const rounds = [...new Set(rows.map((row) => row.round))];

  return (
    <form action={action} className="space-y-5">
      {rounds.map((round) => (
        <section key={round} aria-label={round} className="space-y-2">
          <h3 className="day-label">{round}</h3>
          <ol className="day-card divide-y divide-day-line/[0.07]">
            {rows
              .filter((row) => row.round === round)
              .map((row) => (
                <li key={row.id} className="grid grid-cols-[minmax(0,1fr)] items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_11rem] sm:gap-3">
                  <input type="hidden" name="matchId" value={row.id} />
                  <span className="min-w-0">
                    {row.label ? <span className="block text-xs font-semibold text-day-muted">{row.label}{row.played ? " · played" : ""}</span> : null}
                    <span className="block truncate font-semibold text-day-ink">
                      {row.teamA || row.teamB ? `${row.teamA || "To be decided"} v ${row.teamB || "To be decided"}` : <span className="italic text-day-faint">To be decided</span>}
                    </span>
                  </span>
                  <input
                    type="time"
                    name="time"
                    value={timeOf[row.id] ?? ""}
                    onChange={(event) => setTimeOf((current) => ({ ...current, [row.id]: event.target.value }))}
                    aria-label={`Time of ${round}${row.label ? ` ${row.label}` : ""}`}
                    className="day-input day-num h-11"
                  />
                  <MazeSelect
                    name="maze"
                    value={mazeOf[row.id] ?? ""}
                    mazes={mazes}
                    label={`Maze for ${round}${row.label ? ` ${row.label}` : ""}`}
                    onChange={(maze) => setMazeOf((current) => ({ ...current, [row.id]: maze }))}
                  />
                </li>
              ))}
          </ol>
        </section>
      ))}
      <div className="flex justify-end">
        <Submit pending="Saving…">Save the times and mazes</Submit>
      </div>
      <Notice state={state} />
    </form>
  );
}
