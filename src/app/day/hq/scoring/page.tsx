import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { TEST_DATA_BY } from "@/lib/test-data";
import { QUALIFIERS, QUALIFYING_STATUS_LABELS } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { competitionDayKey, qualifyingSlot } from "@/lib/match-results";
import { prisma } from "@/lib/prisma";
import { scoreSheet } from "@/lib/score-sheet";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { ArmedForm, DeskForm, DeskHead, Submit } from "../DeskKit";
import { loadQueue } from "@/lib/day-queue";
import {
  callBack,
  callChosen,
  callNext,
  clearRunOrder,
  drawBracket,
  drawRunOrder,
  generateTestSheets,
  removeTestSheets,
  reopenQualifying,
  saveScoringSettings,
  standDown,
} from "./actions";
import { QualifyingDesk, type DeskTeam } from "./QualifyingDesk";
import { RevealBanner } from "./RevealBanner";
import { TransferPanel } from "./TransferPanel";
import { openDaySite } from "@/lib/day-links";

export const metadata: Metadata = { title: "Qualifying" };

/**
 * Phase 1: the running order, every team's match sheet, and closing it all
 * into the bracket.
 */
export default async function QualifyingDeskPage() {
  const admin = await requireSection("/day/hq/scoring");
  const isMaster = rolesOf(admin).includes("MASTER");
  const [state, config, sheets, queue] = await Promise.all([
    loadCompetition(),
    getCompetitionDayConfig(),
    prisma.qualifyingRun.findMany({ orderBy: { createdAt: "asc" } }),
    loadQueue(),
  ]);
  const locked = state.qualifyingStatus === "LOCKED";
  const sheetOf = new Map(sheets.map((sheet) => [sheet.registrationId, sheet]));

  // Slot times: a team's own, or the start plus a slot per place.
  const day = competitionDayKey(config.eventDate);
  const slotOf = (team: { runOrder: number | null; slotTime: string }) => {
    const at = qualifyingSlot(team, config, day);
    return at ? clockTime(at) : "";
  };

  const teams: DeskTeam[] = state.competitors.map((team) => {
    const row = sheetOf.get(team.id);
    const standing = team.standing;
    const sheet = row ? scoreSheet({ times: row.runTimes, remaining: row.remaining, log: row.runLog }) : null;
    return {
      id: team.id,
      name: team.name,
      eligible: team.eligible,
      reason: team.withdrawn ? "withdrawn" : team.inspection === "FAILED" ? "failed inspection" : "",
      checkedIn: team.checkedIn,
      runOrder: team.runOrder,
      slot: slotOf(team),
      rank: standing?.rank ?? null,
      qualified: !!standing?.qualified,
      override: standing?.override ?? "",
      sheet: row && sheet
        ? {
            log: sheet.log,
            runs: sheet.runs,
            failed: sheet.failed,
            remaining: sheet.remaining,
            score: standing?.best ?? row.score,
            official: standing?.official ?? null,
            note: row.note,
            recordedBy: row.recordedBy,
            legacy: sheet.log.length === 0 && row.score !== null,
          }
        : null,
    };
  });

  const ran = state.table.filter((row) => row.recorded).length;
  const testSheets = sheets.filter((sheet) => sheet.recordedBy === TEST_DATA_BY).length;
  const qualifiedCount = state.table.filter((row) => row.qualified).length;
  const drawn = teams.filter((team) => team.runOrder !== null).length;

  return (
    <div className="space-y-8">
      <DeskHead
        icon="timer"
        title="Qualifying"
        lead={`Phase 1 · ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus]} · ${ran} of ${state.competitors.length} teams have run. Write down every run and whether it reached the centre; the score is (successful runs ÷ fastest time) × 1000.`}
      />

      <RevealBanner phases={[1]} />

      {/* ------------------------------------------------ running order */}
      <section className="day-card grid grid-cols-[minmax(0,1fr)] gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="day-kicker">Running order</p>
          <p className="day-display mt-2 text-2xl text-day-ink">
            {drawn ? `${drawn} teams drawn${config.runOrderStart ? `, first at ${config.runOrderStart}` : ""}` : "Not drawn yet"}
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

      {/* --------------------------------------------------- call queue */}
      {queue.active ? (
        <section className="day-card space-y-6 p-5 sm:p-6" aria-labelledby="queue-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="day-kicker">Call queue</p>
              <h2 id="queue-title" className="day-display mt-2 text-2xl text-day-ink">
                {queue.queue.now ? `${queue.queue.now.name} on the maze` : "Nobody called yet"}
              </h2>
              <p className="mt-1 text-sm text-day-muted">
                {queue.queue.ran} of {queue.queue.total} have run · {queue.queue.upcoming.length} still to call. The hall screen, the live page and each
                team&rsquo;s page follow this.
              </p>
            </div>
            <a href={openDaySite("/day/screen")} target="_blank" className="day-btn day-btn-soft day-btn-sm">
              <DayIcon name="live" className="h-4 w-4" />
              Hall screen
            </a>
          </div>

          <ol className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            {[
              { label: "On the maze", entry: queue.queue.now, note: queue.calledAt && queue.queue.now ? `Called at ${clockTime(queue.calledAt)}` : "" },
              { label: "On deck", entry: queue.queue.onDeck, note: queue.queue.onDeck ? queue.etaOf(queue.queue.onDeck.id) : "" },
              { label: "In the hole", entry: queue.queue.inHole, note: queue.queue.inHole ? queue.etaOf(queue.queue.inHole.id) : "" },
            ].map((tile, index) => (
              <li key={tile.label} className={`day-sunk p-4 ${index === 0 && tile.entry ? "ring-2 ring-day-live/50" : ""}`}>
                <p className={`flex items-center gap-2 text-xs font-semibold ${index === 0 ? "text-day-live" : "text-day-muted"}`}>
                  {index === 0 && tile.entry ? <span className="day-live-dot" aria-hidden="true" /> : null}
                  {tile.label}
                </p>
                <p className="day-display mt-2 truncate text-xl text-day-ink">{tile.entry?.name ?? "–"}</p>
                <p className="day-num mt-1 text-xs text-day-faint">
                  {tile.entry?.runOrder ? `#${tile.entry.runOrder}` : ""}
                  {tile.note ? ` · ${tile.note}` : ""}
                </p>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-start gap-3">
            <DeskForm action={callNext} className="space-y-3">
              <Submit pending="Calling…">{queue.queue.onDeck ? `Call ${queue.queue.onDeck.name}` : "Call next"}</Submit>
            </DeskForm>
            {queue.queue.now || config.queueHistory ? (
              <DeskForm action={callBack} className="space-y-3">
                <Submit pending="…" variant="secondary">
                  Back one
                </Submit>
              </DeskForm>
            ) : null}
            {queue.queue.now ? (
              <DeskForm action={standDown} className="space-y-3">
                <Submit pending="…" variant="ghost">
                  Stand down
                </Submit>
              </DeskForm>
            ) : null}
          </div>

          <DeskForm action={callChosen} className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-sm">
              <label className="day-label" htmlFor="queue-team">
                Call a team out of turn
              </label>
              <select id="queue-team" name="teamId" className="day-input" defaultValue="">
                <option value="" disabled>
                  Pick a team
                </option>
                {queue.entries
                  .filter((entry) => entry.runOrder !== null && entry.eligible)
                  .sort((a, b) => a.runOrder! - b.runOrder!)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      #{entry.runOrder} {entry.name}
                      {entry.ran ? " (has run)" : ""}
                    </option>
                  ))}
              </select>
            </div>
            <Submit pending="Calling…" variant="secondary">
              Call
            </Submit>
          </DeskForm>
        </section>
      ) : null}

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

      <TransferPanel drawn={state.drawn} />

      {isMaster ? (
        <section className="day-card space-y-5 border border-dashed border-day-plum/30 p-5 sm:p-6" aria-labelledby="test-data-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="day-kicker">Master only</p>
              <h2 id="test-data-title" className="day-display mt-2 text-2xl text-day-ink">
                Test data
              </h2>
              <p className="mt-1 text-sm text-day-muted">
                Fill every team without a sheet with a random one, to try the desks, the standings, the hall screen and the draw before the day. Test
                sheets are marked, and removing them removes only them: a real sheet is never touched.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${testSheets ? "bg-day-plum/15 text-day-plum" : "bg-day-ink/[0.06] text-day-muted"}`}>
              {testSheets ? `${testSheets} test sheet${testSheets === 1 ? "" : "s"} in` : "No test data"}
            </span>
          </div>
          {locked ? (
            <p className="text-sm text-day-muted">The bracket is drawn. Reopen qualifying to add or remove test data.</p>
          ) : (
            <div className="flex flex-wrap items-start gap-3">
              <ArmedForm
                action={generateTestSheets}
                label="Fill with random test sheets"
                warning={
                  <>
                    Every eligible team without a sheet gets a random one, on the live site.
                    {config.dayAudience === "PUBLIC" ? <strong> The day site is public, so visitors will see them.</strong> : " Only people who can open the day site will see them."}
                  </>
                }
                confirm="Add test data"
              />
              {testSheets ? (
                <ArmedForm
                  action={removeTestSheets}
                  label="Remove the test data"
                  destructive
                  warning={`The ${testSheets} test sheet${testSheets === 1 ? "" : "s"} go. Real sheets stay exactly as they are.`}
                  confirm="Remove test data"
                />
              ) : null}
            </div>
          )}
        </section>
      ) : null}

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
