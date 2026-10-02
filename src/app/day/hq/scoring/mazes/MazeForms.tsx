"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { shareOut } from "@/lib/mazes";
import { Notice, Submit } from "../../DeskKit";
import { EMPTY_DESK_STATE } from "../../state";
import { saveMatchMazes, saveQualifyingMazes } from "./actions";

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

export interface MatchMazeRow {
  id: string;
  label: string;
  teamA: string;
  teamB: string;
  mazeA: string;
  mazeB: string;
}

/** A knockout round: each match's two sides, one maze each. */
export function MatchMazes({ matches, mazes }: { matches: MatchMazeRow[]; mazes: string[] }) {
  const [state, action] = useFormState(saveMatchMazes, EMPTY_DESK_STATE);
  const [values, setValues] = useState<Record<string, { a: string; b: string }>>(() =>
    Object.fromEntries(matches.map((match) => [match.id, { a: match.mazeA, b: match.mazeB }])),
  );
  const set = (id: string, side: "a" | "b", maze: string) => setValues((current) => ({ ...current, [id]: { ...current[id]!, [side]: maze } }));
  const sideBySide = (a: string, b: string) => setValues(Object.fromEntries(matches.map((match) => [match.id, { a, b }])));

  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {mazes.length > 1 ? (
          <>
            <button type="button" onClick={() => sideBySide(mazes[0]!, mazes[1]!)} className="day-btn day-btn-soft day-btn-sm">
              Top team on {mazes[0]}, bottom on {mazes[1]}
            </button>
            <button type="button" onClick={() => sideBySide(mazes[1]!, mazes[0]!)} className="day-btn day-btn-soft day-btn-sm">
              Top team on {mazes[1]}, bottom on {mazes[0]}
            </button>
          </>
        ) : null}
        <button type="button" onClick={() => sideBySide("", "")} className="day-btn day-btn-soft day-btn-sm">
          Clear
        </button>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        {matches.map((match) => (
          <li key={match.id} className="day-card p-4">
            <input type="hidden" name="matchId" value={match.id} />
            <p className="text-xs font-semibold text-day-muted">{match.label}</p>
            {(["a", "b"] as const).map((side) => {
              const team = side === "a" ? match.teamA : match.teamB;
              return (
                <div key={side} className="mt-2 flex items-center gap-3">
                  <span className={`min-w-0 flex-1 truncate font-semibold ${team ? "text-day-ink" : "italic text-day-faint"}`}>{team || "To be decided"}</span>
                  <span className="w-40 shrink-0 sm:w-44">
                    <MazeSelect
                      name={side === "a" ? "mazeA" : "mazeB"}
                      value={values[match.id]?.[side] ?? ""}
                      mazes={mazes}
                      label={`Maze for ${team || "the other side"} in ${match.label}`}
                      onChange={(maze) => set(match.id, side, maze)}
                    />
                  </span>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Submit pending="Saving…">Save these mazes</Submit>
      </div>
      <Notice state={state} />
    </form>
  );
}
