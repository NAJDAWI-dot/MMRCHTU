import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { loadCompetition } from "@/lib/competition";
import { prisma } from "@/lib/prisma";
import {
  DIRECTION_LABELS,
  QUALIFIERS,
  QUALIFYING_STATUS_LABELS,
  formatScore,
} from "@/lib/bracket";
import { clockTime } from "@/lib/day-mode";
import { deleteRun, addRun, drawBracket, reopenQualifying, saveScoringSettings } from "./actions";
import { ArmedForm, DeskForm, Submit, inputClass, labelClass } from "../DeskKit";
import { DeskTabs } from "../DeskTabs";

export const metadata: Metadata = { title: "Admin | Qualifying" };

/**
 * Phase one: record runs, watch the table, and lock it into the bracket.
 */
export default async function QualifyingDeskPage() {
  const admin = await requireSection("/admin/day/scoring");
  const [state, recent] = await Promise.all([
    loadCompetition(),
    prisma.qualifyingRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { registration: { select: { teamName: true } } },
    }),
  ]);
  const locked = state.qualifyingStatus === "LOCKED";
  const ranked = state.table.filter((row) => row.rank !== null);
  const qualifiedCount = state.table.filter((row) => row.qualified).length;

  return (
    <div>
      <AdminPageHeader
        title="Qualifying"
        subtitle={`Phase 1 · ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus]} · ${ranked.length} of ${state.competitors.length} teams have a score`}
      />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day/scoring" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
            Record a run
          </h2>
          {locked ? (
            <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
              Qualifying is locked because the bracket is drawn. Reopen it below to add a run.
            </p>
          ) : (
            <DeskForm action={addRun} resetOnSuccess className="mt-3 space-y-3">
              <div>
                <label className={labelClass} htmlFor="run-team">
                  Team
                </label>
                <select id="run-team" name="teamId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Choose a team
                  </option>
                  {state.competitors.map((team) => (
                    <option key={team.id} value={team.id} disabled={!team.eligible}>
                      {team.name}
                      {team.eligible ? "" : team.withdrawn ? " (withdrawn)" : " (failed inspection)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="run-score">
                    Score
                  </label>
                  <input id="run-score" name="score" inputMode="decimal" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="run-note">
                    Note (optional)
                  </label>
                  <input id="run-note" name="note" maxLength={200} className={inputClass} placeholder="Run 2, maze A" />
                </div>
              </div>
              <Submit pending="Recording…">Record run</Submit>
            </DeskForm>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
            How scores are compared
          </h2>
          <DeskForm action={saveScoringSettings} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="q-dir">
                  Qualifying
                </label>
                <select id="q-dir" name="qualifyingDirection" defaultValue={state.qualifyingDirection} className={inputClass}>
                  <option value="HIGHER">{DIRECTION_LABELS.HIGHER}</option>
                  <option value="LOWER">{DIRECTION_LABELS.LOWER}</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="m-dir">
                  Knockout matches
                </label>
                <select id="m-dir" name="matchDirection" defaultValue={state.matchDirection} className={inputClass}>
                  <option value="HIGHER">{DIRECTION_LABELS.HIGHER}</option>
                  <option value="LOWER">{DIRECTION_LABELS.LOWER}</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="q-note">
                How qualifying works (shown on the standings page)
              </label>
              <textarea
                id="q-note"
                name="qualifyingNote"
                rows={3}
                defaultValue={state.qualifyingNote}
                placeholder="Each team gets three runs in the maze. The best one counts."
                className={inputClass}
              />
            </div>
            <Submit pending="Saving…" variant="secondary">
              Save settings
            </Submit>
          </DeskForm>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
              {locked ? "The bracket is drawn" : "Lock qualifying and draw the bracket"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ras-gray dark:text-white/70">
              {locked
                ? "Results go in on the Bracket desk. Reopening qualifying clears the bracket."
                : `The top ${QUALIFIERS} go through: 1st plays 32nd, 2nd plays 31st, and so on. ${qualifiedCount} team${qualifiedCount === 1 ? " is" : "s are"} in the top ${QUALIFIERS} right now.`}
            </p>
          </div>
          {locked ? (
            <div className="flex flex-wrap items-start gap-3">
              <Link
                href="/admin/day/scoring/bracket"
                className="inline-flex items-center rounded-md bg-ras-purple px-4 py-2 text-sm font-semibold text-white"
              >
                Open the bracket →
              </Link>
              <ArmedForm
                action={reopenQualifying}
                label="Reopen qualifying"
                destructive
                confirm="Yes, clear the bracket"
                warning="This takes the bracket down and lets runs be recorded again."
              >
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="force" value="yes" className="h-4 w-4" />
                  Throw away the results already entered
                </label>
              </ArmedForm>
            </div>
          ) : (
            <ArmedForm
              action={drawBracket}
              label="Lock and draw"
              confirm="Yes, lock it and draw"
              warning={`Qualifying locks, and the top ${Math.min(qualifiedCount, QUALIFIERS)} are drawn into the round of 32 in seed order. The table below is what they are drawn from.`}
            >
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="force" value="yes" className="h-4 w-4" />
                Throw away the results already entered
              </label>
            </ArmedForm>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
            Standings
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ras-gray dark:text-white/55">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Team</th>
                  <th className="py-2 pr-2 text-right">Best</th>
                  <th className="py-2 text-right">Runs</th>
                </tr>
              </thead>
              <tbody>
                {state.table.map((row, index) => (
                  <tr
                    key={row.teamId}
                    className={`border-t border-ras-gray/10 dark:border-white/10 ${
                      row.rank === QUALIFIERS + 1 || (index > 0 && row.rank === null && state.table[index - 1]?.rank !== null)
                        ? "border-t-2 border-t-ras-crimson/60"
                        : ""
                    } ${row.qualified ? "" : "text-ras-gray dark:text-white/50"}`}
                  >
                    <td className="py-1.5 pr-2 font-mono">{row.rank ?? "–"}</td>
                    <td className="py-1.5 pr-2">
                      {row.name}
                      {row.qualified ? (
                        <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                          Top {QUALIFIERS}
                        </span>
                      ) : null}
                      {!row.eligible ? <span className="ml-2 text-xs">(not eligible)</span> : null}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">{formatScore(row.best)}</td>
                    <td className="py-1.5 text-right font-mono">{row.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.table.length === 0 ? (
              <p className="mt-3 text-sm text-ras-gray dark:text-white/60">
                No confirmed teams yet. Teams appear here once their registration is confirmed.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
            Latest runs
          </h2>
          <ul className="mt-3 divide-y divide-ras-gray/10 text-sm dark:divide-white/10">
            {recent.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-semibold text-[var(--color-fg)]">{run.registration.teamName}</span>{" "}
                  <span className="font-mono">{formatScore(run.score)}</span>
                  <span className="block text-xs text-ras-gray dark:text-white/55">
                    {clockTime(run.createdAt)} · {run.recordedBy || "unknown"}
                    {run.note ? ` · ${run.note}` : ""}
                  </span>
                </span>
                {locked ? null : (
                  <form action={deleteRun}>
                    <input type="hidden" name="id" value={run.id} />
                    <button type="submit" className="text-xs font-semibold text-accent hover:underline">
                      Delete
                    </button>
                  </form>
                )}
              </li>
            ))}
            {recent.length === 0 ? (
              <li className="py-2 text-ras-gray dark:text-white/60">No runs recorded yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
