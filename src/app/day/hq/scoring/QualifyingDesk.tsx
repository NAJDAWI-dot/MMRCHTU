"use client";

import { useMemo, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { RunChips } from "@/components/day-site/RunChips";
import { formatPoints, formatReached, formatTime, outcomeText, type RunEntry } from "@/lib/score-sheet";
import { DeskForm, Submit } from "../DeskKit";
import { deleteSheet, saveSheet, setQualifyOverride } from "./actions";
import { MatchClock, RunTimes } from "./RunTimes";

export interface DeskTeam {
  id: string;
  name: string;
  eligible: boolean;
  reason: string;
  checkedIn: boolean;
  runOrder: number | null;
  /** "09:40", when the running order is drawn. */
  slot: string;
  rank: number | null;
  qualified: boolean;
  /** The judges' say: through or out whatever the table says, or "" for the table. */
  override: "" | "IN" | "OUT";
  sheet: {
    /** Every run, successful or not, in order. */
    log: RunEntry[];
    runs: number;
    failed: number;
    remaining: number | null;
    score: number | null;
    official: number | null;
    note: string;
    recordedBy: string;
    /** Only a score, from before run times were recorded. */
    legacy: boolean;
  } | null;
}

/**
 * The qualifying desk: pick a team, write down each run (its time if it
 * reached the centre, the cell it got to if not), save. The score, the official time and the working appear as
 * the times go in, and the table beside it re-ranks the moment it is saved.
 */
export function QualifyingDesk({ teams, locked }: { teams: DeskTeam[]; locked: boolean }) {
  // Next up: the first team in the running order without a sheet.
  const nextUp = useMemo(
    () => [...teams].filter((team) => team.eligible && !team.sheet).sort((a, b) => (a.runOrder ?? 9999) - (b.runOrder ?? 9999))[0]?.id ?? "",
    [teams],
  );
  const [teamId, setTeamId] = useState(nextUp);
  const [query, setQuery] = useState("");
  const team = teams.find((item) => item.id === teamId);

  const ordered = useMemo(
    () =>
      [...teams].sort(
        (a, b) => (a.runOrder ?? 9999) - (b.runOrder ?? 9999) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
      ),
    [teams],
  );
  const listed = ordered.filter((item) => !query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ------------------------------------------------ the sheet form */}
      <section className="day-card h-fit space-y-5 p-5 sm:p-6 lg:sticky lg:top-32">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="day-display text-2xl text-day-ink">Match sheet</h2>
          <MatchClock />
        </div>

        {locked ? (
          <p className="rounded-2xl bg-day-gold/10 p-4 text-sm text-day-ink">
            Qualifying is closed and the bracket is drawn. Reopen qualifying on this page to change a sheet.
          </p>
        ) : (
          <>
            <div>
              <label className="day-label" htmlFor="sheet-team">
                Team
              </label>
              <select id="sheet-team" value={teamId} onChange={(event) => setTeamId(event.target.value)} className="day-input h-12 text-base">
                <option value="" disabled>
                  Choose a team
                </option>
                {ordered.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.eligible}>
                    {item.runOrder ? `#${item.runOrder}  ` : ""}
                    {item.name}
                    {item.slot ? ` · ${item.slot}` : ""}
                    {item.sheet ? "  ✓" : ""}
                    {item.eligible ? "" : ` (${item.reason})`}
                  </option>
                ))}
              </select>
            </div>

            {team ? (
              <DeskForm key={team.id} action={saveSheet} className="space-y-5">
                <input type="hidden" name="teamId" value={team.id} />
                <div className="flex items-center gap-3 rounded-2xl bg-day-sunk p-3">
                  <Crest name={team.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-day-ink">{team.name}</p>
                    <p className="text-xs text-day-muted">
                      {team.sheet
                        ? team.sheet.recordedBy === "test-data"
                          ? "Has a random test sheet. Saving replaces it with a real one."
                          : `Has a sheet, saved by ${team.sheet.recordedBy || "the desk"}. Saving replaces it.`
                        : "No sheet yet."}
                      {team.checkedIn ? "" : " Not checked in."}
                    </p>
                  </div>
                </div>
                <RunTimes
                  name="time"
                  resultName="result"
                  cellName="cell"
                  initialLog={team.sheet?.log ?? []}
                  label="Every run, in the order it was run"
                />
                <div>
                  <label className="day-label" htmlFor="sheet-note">
                    Note (staff only)
                  </label>
                  <input id="sheet-note" name="note" defaultValue={team.sheet?.note ?? ""} maxLength={200} className="day-input" placeholder="e.g. run 3 aborted after a touch" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Submit pending="Saving…">Save the sheet</Submit>
                  {nextUp && nextUp !== team.id ? (
                    <button type="button" onClick={() => setTeamId(nextUp)} className="day-btn day-btn-soft">
                      Next team up
                    </button>
                  ) : null}
                </div>
              </DeskForm>
            ) : (
              <p className="text-sm text-day-muted">Choose a team to fill in its sheet.</p>
            )}
          </>
        )}
      </section>

      {/* -------------------------------------------------- every sheet */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="day-display text-2xl text-day-ink">All sheets</h2>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Find a team</span>
            <DayIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-faint" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a team" className="day-input pl-9" />
          </label>
        </div>
        <ul className="space-y-2">
          {listed.map((item) => (
            <li key={item.id} className={`day-card p-4 ${item.id === teamId ? "ring-2 ring-day-plum/40" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="day-num w-9 shrink-0 text-center text-xs font-bold text-day-faint">{item.runOrder ? `#${item.runOrder}` : "–"}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2 font-semibold text-day-ink">
                    <span className="truncate">{item.name}</span>
                    {item.sheet?.recordedBy === "test-data" ? (
                      <span className="shrink-0 rounded-full bg-day-plum/15 px-2 py-0.5 text-[10px] font-bold text-day-plum">Test data</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-day-muted">
                    {!item.eligible
                      ? item.reason
                      : item.sheet
                        ? item.sheet.legacy
                          ? "Score only"
                          : item.sheet.runs
                            ? `${outcomeText(item.sheet)} · official ${formatTime(item.sheet.official)}`
                            : item.sheet.failed
                              ? `${outcomeText(item.sheet)}${item.sheet.remaining !== null ? ` · furthest ${formatReached(item.sheet.remaining)}` : ""}`
                              : "No run reached the centre"
                        : item.slot
                          ? `Runs at ${item.slot}`
                          : item.checkedIn
                            ? "Waiting to run"
                            : "Not checked in"}
                    {item.override === "IN"
                      ? " · through by the judges' decision"
                      : item.override === "OUT"
                        ? " · kept out by the judges' decision"
                        : item.rank
                          ? ` · ${item.qualified ? "in the top 32" : "outside the top 32"}`
                          : ""}
                  </p>
                </div>
                {item.qualified ? (
                  <span className="rounded-full bg-day-good/15 px-2 py-0.5 text-[11px] font-bold text-day-good">Through</span>
                ) : null}
                {item.rank ? <span className="day-num rounded-full bg-day-ink/[0.06] px-2 py-0.5 text-xs font-bold text-day-muted">#{item.rank}</span> : null}
                <span className="day-num day-display w-16 text-right text-2xl text-day-ink">{item.sheet ? formatPoints(item.sheet.score) : ""}</span>
              </div>
              {item.sheet && item.sheet.log.length ? (
                <div className="mt-3 pl-12">
                  <RunChips log={item.sheet.log} official={item.sheet.official} small />
                </div>
              ) : null}
              {!locked && item.eligible ? (
                <div className="mt-3 flex gap-2 pl-12">
                  <button type="button" onClick={() => setTeamId(item.id)} className="day-btn day-btn-soft day-btn-sm">
                    {item.sheet ? "Edit" : "Fill in"}
                  </button>
                  {item.sheet ? (
                    <form
                      action={deleteSheet}
                      onSubmit={(event) => {
                        if (!window.confirm(`Delete ${item.name}'s sheet?`)) event.preventDefault();
                      }}
                    >
                      <input type="hidden" name="teamId" value={item.id} />
                      <button type="submit" className="day-btn day-btn-danger day-btn-sm">
                        Delete
                      </button>
                    </form>
                  ) : null}
                  <form action={setQualifyOverride} className="ml-auto flex overflow-hidden rounded-xl ring-1 ring-day-line/[0.12]" aria-label={`Who decides whether ${item.name} goes through`}>
                    <input type="hidden" name="teamId" value={item.id} />
                    {(
                      [
                        ["", "Table"],
                        ["IN", "Through"],
                        ["OUT", "Out"],
                      ] as const
                    ).map(([value, text]) => (
                      <button
                        key={value || "table"}
                        type="submit"
                        name="override"
                        value={value}
                        aria-pressed={item.override === value}
                        title={value === "" ? "The table decides" : value === "IN" ? "Through, whatever its place" : "Out, whatever its place"}
                        className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                          item.override === value
                            ? value === "OUT"
                              ? "bg-day-live text-day-on-ink"
                              : value === "IN"
                                ? "bg-day-good text-day-on-ink"
                                : "bg-day-ink text-day-on-ink"
                            : "text-day-muted hover:bg-day-ink/[0.06]"
                        }`}
                      >
                        {text}
                      </button>
                    ))}
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
