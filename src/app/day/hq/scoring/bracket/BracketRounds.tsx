"use client";

import { useState } from "react";
import { KNOCKOUT_ROUNDS, PLAYED_ROUNDS, phaseInfo } from "@/lib/bracket";
import { MatchForm, type MatchRow } from "./MatchForm";

/**
 * The rounds as tabs, opening on the one being played: the round of 32 is
 * sixteen matches, and nobody on the desk wants to scroll past it during the
 * final. Only the rounds the bracket was drawn with.
 */
export function BracketRounds({ rows, mazes }: { rows: MatchRow[]; mazes: string[] }) {
  const playable = (row: MatchRow) => !row.void && !!row.teamAId && !!row.teamBId && !row.walkover;
  // The rounds this bracket plays: a draw of sixteen has no round of 32.
  // The play-off gets its own tab, after the final, when the bracket has one.
  const rounds = PLAYED_ROUNDS.filter((item) => rows.some((row) => row.round === item));
  const tabs = rounds.length ? rounds : [...KNOCKOUT_ROUNDS];
  const current = tabs.find((item) => rows.some((row) => row.round === item && playable(row) && !row.winnerId)) ?? tabs[tabs.length - 1]!;
  const [round, setRound] = useState<number>(current);
  const matches = rows.filter((row) => row.round === round && !row.void);

  return (
    <div className="space-y-6">
      <div className="day-no-scrollbar -mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label="Rounds" className="day-segment flex-nowrap">
          {tabs.map((item) => {
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
            key={`${row.id}:${row.teamAId}:${row.teamBId}:${JSON.stringify(row.sheetA.log)}:${JSON.stringify(row.sheetB.log)}:${row.winnerId}:${row.status}:${row.time}:${row.arena}:${row.mazeA}:${row.mazeB}`}
            match={row}
            mazes={mazes}
          />
        ))}
      </div>
    </div>
  );
}
