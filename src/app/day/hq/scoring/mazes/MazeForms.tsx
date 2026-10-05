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
  mazeA: string;
  mazeB: string;
  played: boolean;
}

/**
 * Every knockout match's time and each of its teams' mazes, by hand. A match
 * is head to head: its two teams run at the same time, one on each maze.
 */
export function MatchSchedule({ rows, mazes }: { rows: ScheduleRow[]; mazes: string[] }) {
  const [state, action] = useFormState(saveSchedule, EMPTY_DESK_STATE);
  const sidesOf = () => Object.fromEntries(rows.map((row) => [row.id, { a: row.mazeA, b: row.mazeB }]));
  const [mazeOf, setMazeOf] = useState<Record<string, { a: string; b: string }>>(sidesOf);
  const [timeOf, setTimeOf] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [row.id, row.time])));
  // New times from the server (the automatic timing, another desk) replace
  // what is on screen; the table itself stays, and so does its saved notice.
  const saved = rows.map((row) => `${row.id}:${row.time}:${row.mazeA}/${row.mazeB}`).join(",");
  useEffect(() => {
    setMazeOf(sidesOf());
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
                <li key={row.id} className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_8.5rem] md:gap-4">
                  <input type="hidden" name="matchId" value={row.id} />
                  <div className="min-w-0 space-y-2">
                    {row.label || row.played ? (
                      <p className="text-xs font-semibold text-day-muted">
                        {[row.label, row.played ? "played" : ""].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {(["a", "b"] as const).map((side) => {
                      const team = side === "a" ? row.teamA : row.teamB;
                      return (
                        <div key={side} className="flex items-center gap-3">
                          <span className={`min-w-0 flex-1 truncate font-semibold ${team ? "text-day-ink" : "italic text-day-faint"}`}>{team || "To be decided"}</span>
                          <span className="w-36 shrink-0 sm:w-44">
                            <MazeSelect
                              name={side === "a" ? "mazeA" : "mazeB"}
                              value={mazeOf[row.id]?.[side] ?? ""}
                              mazes={mazes}
                              label={`Maze for ${team || "the other side"} in ${round}${row.label ? ` ${row.label}` : ""}`}
                              onChange={(maze) => setMazeOf((current) => ({ ...current, [row.id]: { ...current[row.id]!, [side]: maze } }))}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <label className="block">
                    <span className="day-label md:sr-only">Start</span>
                    <input
                      type="time"
                      name="time"
                      value={timeOf[row.id] ?? ""}
                      onChange={(event) => setTimeOf((current) => ({ ...current, [row.id]: event.target.value }))}
                      aria-label={`Time of ${round}${row.label ? ` ${row.label}` : ""}`}
                      className="day-input day-num h-11"
                    />
                  </label>
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
