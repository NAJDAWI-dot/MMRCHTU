"use client";

import { useFormState } from "react-dom";
import { Notice, Submit, inputClass, labelClass } from "../../DeskKit";
import { EMPTY_DESK_STATE } from "../../state";
import { saveMatch } from "../actions";

export interface MatchRow {
  id: string;
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  teamA: string;
  teamB: string;
  seedA: number | null;
  seedB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: string;
  arena: string;
  walkover: boolean;
  void: boolean;
  tied: boolean;
}

/** One match's result, on the Bracket desk. */
export function MatchForm({ match }: { match: MatchRow }) {
  const [state, action] = useFormState(saveMatch, EMPTY_DESK_STATE);
  const ready = !!match.teamAId && !!match.teamBId;
  const done = !!match.winnerId;

  return (
    <form
      action={action}
      className={`rounded-xl border p-3 text-sm ${
        match.status === "LIVE"
          ? "border-ras-crimson/50 bg-ras-crimson/5"
          : done
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-ras-gray/20 dark:border-white/10"
      }`}
    >
      <input type="hidden" name="id" value={match.id} />
      <p className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wide text-ras-gray dark:text-white/55">
        <span>{match.label}</span>
        <span>{match.void ? "No match" : match.walkover ? "Bye" : done ? "Done" : match.status === "LIVE" ? "Live" : "Waiting"}</span>
      </p>

      {[
        { side: "A", id: match.teamAId, name: match.teamA, seed: match.seedA, score: match.scoreA },
        { side: "B", id: match.teamBId, name: match.teamB, seed: match.seedB, score: match.scoreB },
      ].map((entry) => (
        <div key={entry.side} className="mt-2 flex items-center gap-2">
          <span className="w-7 shrink-0 text-right font-mono text-xs text-ras-gray dark:text-white/50">
            {entry.seed ?? ""}
          </span>
          <span
            className={`min-w-0 flex-1 truncate ${
              match.winnerId && match.winnerId === entry.id
                ? "font-bold text-emerald-700 dark:text-emerald-300"
                : entry.id
                  ? "text-[var(--color-fg)]"
                  : "italic text-ras-gray dark:text-white/40"
            }`}
          >
            {entry.name}
          </span>
          <input
            name={`score${entry.side}`}
            aria-label={`Score for ${entry.name}`}
            inputMode="decimal"
            defaultValue={entry.score ?? ""}
            disabled={!ready}
            className="w-20 rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-right font-mono text-sm disabled:opacity-40"
          />
        </div>
      ))}

      {ready ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Winner</label>
            <select name="winnerId" defaultValue={match.winnerId ?? ""} className={inputClass}>
              <option value="">By score</option>
              <option value={match.teamAId!}>{match.teamA}</option>
              <option value={match.teamBId!}>{match.teamB}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" defaultValue={match.status === "LIVE" ? "LIVE" : "PENDING"} className={inputClass}>
              <option value="PENDING">Waiting</option>
              <option value="LIVE">On the maze now</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Maze</label>
            <input name="arena" defaultValue={match.arena} placeholder="Maze A" className={inputClass} />
          </div>
        </div>
      ) : null}

      {ready ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-ras-gray dark:text-white/60">
            <input type="checkbox" name="clearLater" value="yes" className="h-3.5 w-3.5" />
            Clear the later results if this changes them
          </label>
          <Submit pending="Saving…" size="sm">
            Save result
          </Submit>
        </div>
      ) : null}
      {match.tied && !match.winnerId ? (
        <p className="mt-2 text-xs font-semibold text-accent">Level on score: pick the winner.</p>
      ) : null}
      <div className="mt-2">
        <Notice state={state} />
      </div>
    </form>
  );
}
