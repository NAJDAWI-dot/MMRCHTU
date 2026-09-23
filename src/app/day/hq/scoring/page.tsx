import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection } from "@/lib/admin-access";
import { QUALIFIERS, QUALIFYING_STATUS_LABELS } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { zonedInstant } from "@/lib/day-slots";
import { clockTime, dayKey, runningDayKey } from "@/lib/day-mode";
import { prisma } from "@/lib/prisma";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { ArmedForm, DeskForm, DeskHead, Submit } from "../DeskKit";
import { clearRunOrder, drawBracket, drawRunOrder, reopenQualifying, saveScoringSettings } from "./actions";
import { QualifyingDesk, type DeskTeam } from "./QualifyingDesk";

export const metadata: Metadata = { title: "Qualifying" };

/**
 * Phase 1: the running order, every team's match sheet, and closing it all
 * into the bracket.
 */
export default async function QualifyingDeskPage() {
  await requireSection("/day/hq/scoring");
  const [state, config, sheets] = await Promise.all([
    loadCompetition(),
    getCompetitionDayConfig(),
    prisma.qualifyingRun.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const locked = state.qualifyingStatus === "LOCKED";
  const sheetOf = new Map(sheets.map((sheet) => [sheet.registrationId, sheet]));

  // Slot times from the running order: the start, plus a slot per place.
  const day = config.eventDate ? dayKey(config.eventDate) : runningDayKey(new Date());
  const startAt = config.runOrderStart ? zonedInstant(day, config.runOrderStart) : null;
  const slotOf = (order: number | null) =>
    startAt && order ? clockTime(new Date(startAt.getTime() + (order - 1) * config.runSlotMinutes * 60_000)) : "";

  const teams: DeskTeam[] = state.competitors.map((team) => {
    const row = sheetOf.get(team.id);
    const standing = team.standing;
    return {
      id: team.id,
      name: team.name,
      eligible: team.eligible,
      reason: team.withdrawn ? "withdrawn" : team.inspection === "FAILED" ? "failed inspection" : "",
      checkedIn: team.checkedIn,
      runOrder: team.runOrder,
      slot: slotOf(team.runOrder),
      rank: standing?.rank ?? null,
      qualified: !!standing?.qualified,
      sheet: row
        ? {
            times: row.runTimes,
            remaining: row.remaining,
            score: standing?.best ?? row.score,
            official: standing?.official ?? null,
            note: row.note,
            recordedBy: row.recordedBy,
            legacy: row.runTimes.length === 0 && row.score !== null,
          }
        : null,
    };
  });

  const ran = state.table.filter((row) => row.recorded).length;
  const qualifiedCount = state.table.filter((row) => row.qualified).length;
  const drawn = teams.filter((team) => team.runOrder !== null).length;

  return (
    <div className="space-y-8">
      <DeskHead
        icon="timer"
        title="Qualifying"
        lead={`Phase 1 · ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus]} · ${ran} of ${state.competitors.length} teams have run. Type each successful run's time; the score is (runs ÷ fastest time) × 1000.`}
      />

      {/* ------------------------------------------------ running order */}
      <section className="day-card grid grid-cols-[minmax(0,1fr)] gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="day-kicker">Running order</p>
          <p className="day-display mt-2 text-2xl text-day-ink">
            {drawn ? `${drawn} teams drawn, first at ${config.runOrderStart}` : "Not drawn yet"}
          </p>
          <p className="mt-1 text-sm text-day-muted">
            Once check-in closes, draw a random order among the teams that checked in. Each gets a slot on the qualifying list and its team page.
          </p>
        </div>
        {locked ? null : (
          <div className="flex flex-wrap items-end gap-3">
            <DeskForm action={drawRunOrder} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="day-label" htmlFor="ro-start">
                  First run at
                </label>
                <input id="ro-start" name="start" defaultValue={config.runOrderStart || "09:30"} className="day-input day-num w-28" />
              </div>
              <div>
                <label className="day-label" htmlFor="ro-min">
                  Minutes a slot
                </label>
                <input id="ro-min" name="minutes" type="number" min={1} max={60} defaultValue={config.runSlotMinutes} className="day-input day-num w-28" />
              </div>
              <Submit pending="Drawing…" variant={drawn ? "secondary" : "primary"}>
                {drawn ? "Draw again" : "Draw the order"}
              </Submit>
            </DeskForm>
            {drawn ? (
              <DeskForm action={clearRunOrder} className="flex items-end">
                <Submit pending="…" variant="ghost">
                  Clear
                </Submit>
              </DeskForm>
            ) : null}
          </div>
        )}
      </section>

      <QualifyingDesk teams={teams} locked={locked} />

      {/* ------------------------------------------- close and draw */}
      <section className="day-card flex flex-wrap items-end justify-between gap-6 p-5 sm:p-6">
        <div className="max-w-xl">
          <p className="day-kicker">{locked ? "The bracket is drawn" : "Close qualifying"}</p>
          <p className="day-display mt-2 text-2xl text-day-ink">{locked ? "Results go in on the Bracket desk" : "Draw the top 32 into the bracket"}</p>
          <p className="mt-1 text-sm text-day-muted">
            {locked
              ? "Reopening qualifying clears the bracket."
              : `1st plays 32nd, 2nd plays 31st, and so on. ${qualifiedCount} team${qualifiedCount === 1 ? " is" : "s are"} in the top ${QUALIFIERS} right now.`}
          </p>
        </div>
        {locked ? (
          <div className="flex flex-wrap items-start gap-3">
            <Link href="/day/hq/scoring/bracket" className="day-btn day-btn-ink">
              Open the bracket
              <DayIcon name="arrow" className="h-4 w-4" />
            </Link>
            <ArmedForm
              action={reopenQualifying}
              label="Reopen qualifying"
              destructive
              warning="This takes the bracket down. Any knockout results are lost."
              confirm="Reopen"
            >
              <label className="flex items-center gap-2 text-sm text-day-ink">
                <input type="checkbox" name="force" value="yes" /> Throw away the results
              </label>
            </ArmedForm>
          </div>
        ) : (
          <ArmedForm
            action={drawBracket}
            label="Close qualifying and draw"
            warning={`The top ${Math.min(QUALIFIERS, qualifiedCount)} are seeded into the round of 32 and match sheets lock.`}
            confirm="Draw the bracket"
          >
            <label className="flex items-center gap-2 text-sm text-day-ink">
              <input type="checkbox" name="force" value="yes" /> Throw away the results, if the bracket had any
            </label>
          </ArmedForm>
        )}
      </section>

      <section className="day-card p-5 sm:p-6">
        <p className="day-kicker">On the standings page</p>
        <DeskForm action={saveScoringSettings} className="mt-3 space-y-3">
          <label className="day-label" htmlFor="q-note">
            A line under the heading (leave empty for the formula)
          </label>
          <textarea id="q-note" name="qualifyingNote" rows={2} defaultValue={state.qualifyingNote} className="day-input" />
          <Submit pending="Saving…" variant="secondary">
            Save
          </Submit>
        </DeskForm>
      </section>
    </div>
  );
}
