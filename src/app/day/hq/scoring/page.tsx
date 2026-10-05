import { laneOf } from "@/lib/run-queue";
import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { TEST_DATA_BY } from "@/lib/test-data";
import { BRACKET_SIZES, QUALIFYING_STATUS_LABELS } from "@/lib/bracket";
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
  callNextOn,
  clearRunOrder,
  drawBracket,
  drawRunOrder,
  generateTestSheets,
  removeTestSheets,
  reopenQualifying,
  saveScoringSettings,
  setBracketSize,
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
      reason: team.withdrawn ? "withdrawn" : team.inspection === "FAILED" ? "robot not available" : "",
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
        lead={`Phase 1 · ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus]} · ${ran} of ${state.competitors.length} teams have run. Write down every run and whether it reached the centre, and every return (↩) and whether it made it back; the score is ((successful runs + 1.5 × successful returns) ÷ fastest run or return) × 1000.`}
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
            {queue.mazes.length > 1
              ? ` The ${queue.mazes.length} mazes run side by side: the order is shared out round them (${queue.mazes.map((maze, index) => `#${index + 1} on ${maze}`).join(", ")}, and round again), and the teams of one call share a slot.`
              : ""}
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
              <a href="/day/draw" target="_blank" className="day-btn day-btn-ink">
                <DayIcon name="live" className="h-4 w-4" />
                Show the draw
              </a>
            ) : null}
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
                {queue.queue.nowGroup.length
                  ? `${queue.queue.nowGroup.map((entry) => entry.name).join(" and ")} on the maze${queue.queue.nowGroup.length === 1 ? "" : "s"}`
                  : "Nobody called yet"}
              </h2>
              <p className="mt-1 text-sm text-day-muted">
                {queue.queue.ran} of {queue.queue.total} have run · {queue.queue.upcoming.length} still to run
                {queue.queue.lanes > 1 ? `, ${queue.queue.lanes} at a time (${queue.mazes.join(", ")})` : ""}. The hall screen, the live page and each
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
              { label: queue.queue.lanes > 1 ? "On the mazes" : "On the maze", group: queue.queue.nowGroup, note: queue.calledAt && queue.queue.now ? `Called at ${clockTime(queue.calledAt)}` : "" },
              { label: "On deck", group: queue.queue.deckGroup, note: queue.queue.onDeck ? queue.etaOf(queue.queue.onDeck.id) : "" },
              { label: "In the hole", group: queue.queue.holeGroup, note: queue.queue.inHole ? queue.etaOf(queue.queue.inHole.id) : "" },
            ].map((tile, index) => (
              <li key={tile.label} className={`day-sunk p-4 ${index === 0 && tile.group.length ? "ring-2 ring-day-live/50" : ""}`}>
                <p className={`flex items-center gap-2 text-xs font-semibold ${index === 0 ? "text-day-live" : "text-day-muted"}`}>
                  {index === 0 && tile.group.length ? <span className="day-live-dot" aria-hidden="true" /> : null}
                  {tile.label}
                  {tile.note ? <span className="day-num font-medium text-day-faint">· {tile.note}</span> : null}
                </p>
                {tile.group.length ? (
                  <ul className="mt-2 space-y-2">
                    {tile.group.map((entry) => (
                      <li key={entry.id} className="min-w-0">
                        <p className="day-display flex min-w-0 items-center gap-2 text-xl text-day-ink">
                          {entry.code ? <span className="day-num shrink-0 bg-day-ink px-1.5 text-sm font-extrabold text-day-on-ink">{entry.code}</span> : null}
                          <span className="truncate">{entry.name}</span>
                        </p>
                        <p className="day-num text-xs text-day-faint">
                          {entry.runOrder ? `#${entry.runOrder}` : ""}
                          {queue.mazes.length > 1 || entry.maze ? (
                            <span className="ml-1.5 font-semibold text-day-crimson">{entry.maze || queue.mazes[laneOf(entry, queue.mazes)]}</span>
                          ) : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="day-display mt-2 text-xl text-day-ink">–</p>
                )}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-start gap-3">
            <DeskForm action={callNext} className="space-y-3">
              <Submit pending="Calling…">
                {queue.queue.deckGroup.length ? `Call ${queue.queue.deckGroup.map((entry) => entry.name).join(" and ")}` : "Call next"}
              </Submit>
            </DeskForm>
            {/* One maze finished first: call its next team, and leave the other maze running. */}
            {queue.queue.lanes > 1
              ? queue.mazes.map((maze, lane) => {
                  const next = queue.queue.deckGroup.find((entry) => laneOf(entry, queue.mazes) === lane);
                  return next ? (
                    <DeskForm key={maze} action={callNextOn} className="space-y-3">
                      <input type="hidden" name="maze" value={maze} />
                      <Submit pending="…" variant="secondary">
                        Next on {maze}
                      </Submit>
                    </DeskForm>
                  ) : null;
                })
              : null}
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
                Call a team out of turn{queue.queue.lanes > 1 ? " (it goes on its own maze)" : ""}
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

      <QualifyingDesk teams={teams} locked={locked} cut={state.bracketSize} />

      {/* ------------------------------------------- close and draw */}
      <section className="day-card space-y-6 p-5 sm:p-6" aria-labelledby="close-title">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="day-kicker">{locked ? "The bracket is drawn" : "Close qualifying"}</p>
            <h2 id="close-title" className="day-display mt-2 text-2xl text-day-ink">
              {locked ? `The top ${state.bracketSize} are in. Results go in on the Bracket desk` : "Draw the knockout"}
            </h2>
            <p className="mt-1 text-sm text-day-muted">
              {locked
                ? "Reopening qualifying clears the bracket."
                : `Either way, 1st plays last, 2nd plays second to last, and so on up the bracket. ${qualifiedCount} team${qualifiedCount === 1 ? " is" : "s are"} in the top ${state.bracketSize} right now.`}
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
            <DeskForm action={setBracketSize} className="space-y-1">
              <span className="day-label">The standings draw the line at</span>
              <div className="flex overflow-hidden rounded-[4px] ring-1 ring-day-line/[0.12]">
                {BRACKET_SIZES.map((size) => (
                  <button
                    key={size}
                    type="submit"
                    name="size"
                    value={size}
                    aria-pressed={state.bracketSize === size}
                    className={`day-num px-4 py-2 text-sm font-bold transition-colors ${
                      state.bracketSize === size ? "bg-day-ink text-day-on-ink" : "text-day-muted hover:bg-day-ink/[0.06]"
                    }`}
                  >
                    Top {size}
                  </button>
                ))}
              </div>
            </DeskForm>
          )}
        </div>

        {locked ? null : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {BRACKET_SIZES.map((size) => {
              const seeded = Math.min(size, qualifiedCount);
              return (
                <li key={size} className={`day-sunk flex flex-col gap-4 p-5 ${state.bracketSize === size ? "ring-2 ring-day-crimson/40" : ""}`}>
                  <div>
                    <p className="day-display text-3xl text-day-ink">Top {size}</p>
                    <p className="mt-1 text-sm text-day-muted">
                      {size === 32
                        ? "Into the round of 32: 1st v 32nd, 2nd v 31st. Then the round of 16, the quarter-finals, the semi-finals and the final."
                        : "Straight into the round of 16: 1st v 16th, 2nd v 15th. No round of 32. Then the quarter-finals, the semi-finals and the final."}
                    </p>
                  </div>
                  <ArmedForm
                    action={drawBracket}
                    label={`Close qualifying and draw the top ${size}`}
                    warning={`The top ${seeded} are seeded into the ${size === 32 ? "round of 32" : "round of 16"}${seeded < size ? `, with byes for the top ${size - seeded}` : ""}, and match sheets lock.`}
                    confirm={`Draw the top ${size}`}
                  >
                    <input type="hidden" name="size" value={size} />
                    <label className="flex items-center gap-2 text-sm text-day-ink">
                      <input type="checkbox" name="force" value="yes" /> Throw away the results, if the bracket had any
                    </label>
                  </ArmedForm>
                </li>
              );
            })}
          </ul>
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
            <span className={`rounded-[2px] px-3 py-1 text-xs font-bold ${testSheets ? "bg-day-plum/15 text-day-plum" : "bg-day-ink/[0.06] text-day-muted"}`}>
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
