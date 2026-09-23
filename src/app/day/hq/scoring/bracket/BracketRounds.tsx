"use client";

import { useState } from "react";
import { KNOCKOUT_ROUNDS, phaseInfo } from "@/lib/bracket";
import { MatchForm, type MatchRow } from "./MatchForm";

/**
 * The rounds as tabs, opening on the one being played: the round of 32 is
 * sixteen matches, and nobody on the desk wants to scroll past it during the
 * final.
 */
export function BracketRounds({ rows }: { rows: MatchRow[] }) {
  const playable = (row: MatchRow) => !row.void && !!row.teamAId && !!row.teamBId && !row.walkover;
  const current =
    KNOCKOUT_ROUNDS.find((round) => rows.some((row) => row.round === round && playable(row) && !row.winnerId)) ?? KNOCKOUT_ROUNDS[KNOCKOUT_ROUNDS.length - 1]!;
  const [round, setRound] = useState<number>(current);
  const matches = rows.filter((row) => row.round === round && !row.void);

  return (
    <div className="space-y-6">
      <div className="day-no-scrollbar -mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label="Rounds" className="day-segment flex-nowrap">
          {KNOCKOUT_ROUNDS.map((item) => {
            const inRound = rows.filter((row) => row.round === item && playable(row));
            const decided = inRound.filter((row) => row.winnerId).length;
            return (
              <label key={item}>
                <input type="radio" name="round" checked={round === item} onChange={() => setRound(item)} />
                <span className="whitespace-nowrap">
                  {phaseInfo(item).name}
                  <span className="day-num text-xs opacity-60">
                    {decided}/{inRound.length}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        {matches.map((row) => (
          // Keyed by the pairing and the result as well as the id, so a form
          // redraws with fresh values whenever an earlier result changes who
          // is in it; the green "done" state is the confirmation then.
          <MatchForm
            key={`${row.id}:${row.teamAId}:${row.teamBId}:${row.timesA.join()}:${row.timesB.join()}:${row.remainingA}:${row.remainingB}:${row.winnerId}:${row.status}`}
            match={row}
          />
        ))}
      </div>
    </div>
  );
}
