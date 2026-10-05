"use client";

import { useFormState } from "react-dom";
import { DayIcon } from "@/components/day-site/icons";
import { Notice, Submit } from "../DeskKit";
import { EMPTY_CUSTOM_DRAW, EMPTY_DESK_STATE } from "../state";
import { checkCustomDraw, saveCustomDraw } from "./actions";

/**
 * A draw made by hand, pasted from the organisers' sheet: a time per row, a
 * maze per column. Checked first and shown as a table; nothing changes until
 * "Use this draw".
 */
export function CustomDraw() {
  const [check, checkAction] = useFormState(checkCustomDraw, EMPTY_CUSTOM_DRAW);
  const [save, saveAction] = useFormState(saveCustomDraw, EMPTY_DESK_STATE);
  const draw = check.draw;
  const columns = draw ? Math.max(check.mazes.length, ...draw.rows.map((row) => row.cells.length)) : 0;

  return (
    <details className="day-card group p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-day-ink [&::-webkit-details-marker]:hidden">
        <DayIcon name="timer" className="h-4 w-4 text-day-muted" />
        Use a custom draw from a sheet
        <span className="ml-auto text-xs font-medium text-day-muted group-open:hidden">Open</span>
      </summary>

      <form action={checkAction} className="mt-4 space-y-3">
        <label htmlFor="custom-draw" className="block text-sm text-day-muted">
          Copy the sheet and paste it here: a heading row with the maze names, then one row per time slot with a team in each maze&apos;s column, like
          <span className="day-num"> 11:30 · A3 - HyperMind · C8 - Tom &amp; Jerry</span>. Teams are found by their code. Each team runs at its row&apos;s time on its
          column&apos;s maze, and the teams of one row are called together. Nothing changes until you press Use this draw.
        </label>
        <textarea
          id="custom-draw"
          name="list"
          rows={8}
          required
          spellCheck={false}
          className="day-input w-full font-mono text-sm"
          placeholder={"time slot\tMaze A\tMaze B\n11:30\tA3 - Team\tC8 - Team"}
        />
        <Submit pending="Checking…" variant="secondary">
          Check the draw
        </Submit>
        {check.ok ? null : <Notice state={check} />}
      </form>

      {draw ? (
        <div className="mt-6 space-y-4 border-t border-day-line/[0.1] pt-5">
          <p className="text-sm font-semibold text-day-ink">
            {draw.placed} teams in {draw.rows.length} slots, {draw.rows[0]?.time} to {draw.rows[draw.rows.length - 1]?.time}
            {check.mazes.length ? `, on ${check.mazes.join(" and ")}` : ""}.
          </p>

          {draw.problems.length ? (
            <section className="space-y-2" aria-label="Problems">
              <h3 className="day-label text-day-live">Fix these in the sheet, then check it again</h3>
              <ul className="space-y-1 border border-day-live/30 px-3 py-2 text-sm text-day-ink">
                {draw.problems.map((problem) => (
                  <li key={problem} dir="auto">
                    {problem}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="max-h-[28rem] overflow-auto border border-day-line/[0.12]">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="sticky top-0 bg-day-surface text-left text-xs text-day-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Time
                  </th>
                  {Array.from({ length: columns }, (_, column) => (
                    <th key={column} scope="col" className="px-3 py-2 font-semibold">
                      {check.mazes[column] ?? `Column ${column + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-day-line/[0.07]">
                {draw.rows.map((row, index) => (
                  <tr key={`${row.time}-${index}`}>
                    <td className="day-num whitespace-nowrap px-3 py-2 font-semibold text-day-ink">{row.time}</td>
                    {Array.from({ length: columns }, (_, column) => {
                      const cell = row.cells[column];
                      return (
                        <td key={column} className="px-3 py-2" dir="auto">
                          {cell ? (
                            <span className="flex min-w-0 items-center gap-2">
                              {cell.code ? <span className="day-num shrink-0 bg-day-ink px-1.5 text-xs font-bold text-day-on-ink">{cell.code}</span> : null}
                              <span className="truncate text-day-ink">{cell.name}</span>
                              <span className="day-num ml-auto shrink-0 text-xs text-day-faint">#{cell.order}</span>
                            </span>
                          ) : (
                            <span className="text-day-faint">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {draw.missing.length ? (
            <p className="text-sm text-day-muted">
              Not in the sheet, so no slot: <span dir="auto">{draw.missing.map((team) => (team.code ? `${team.code} ${team.name}` : team.name)).join(", ")}</span>.
            </p>
          ) : null}

          {draw.problems.length ? null : (
            <form action={saveAction} className="space-y-3">
              <input type="hidden" name="list" value={check.list} />
              <p className="text-sm text-day-muted">This replaces the running order and restarts the call queue.</p>
              <Submit pending="Saving…" variant="good">
                Use this draw
              </Submit>
              <Notice state={save} />
            </form>
          )}
        </div>
      ) : null}
    </details>
  );
}
