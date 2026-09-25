import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { PlaceBlock, RunTicks, gapToLeader } from "@/components/day-site/Tower";
import { TowerMotion } from "@/components/day-site/TowerMotion";
import { Empty, HeldBack, PageHead, Readout, SheetView } from "@/components/day-site/ui";
import { QUALIFIERS, QUALIFYING_STATUS_LABELS, type Standing } from "@/lib/bracket";
import { loadPublicCompetition } from "@/lib/public-competition";
import { formatPoints, formatReached, formatTime } from "@/lib/score-sheet";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;
export const metadata: Metadata = { title: "Standings" };

/** Where a team is on the sheet, in a few words, for under its name. */
function sheetLine(row: Standing): string {
  if (!row.eligible) return "Not eligible";
  if (!row.recorded) return "Yet to run";
  if (!row.runs) return row.remaining !== null ? `No run reached the centre · furthest ${formatReached(row.remaining)}` : "No run reached the centre";
  return `${row.failed ? `${row.runs} of ${row.runs + row.failed} runs` : `${row.runs} run${row.runs === 1 ? "" : "s"}`} · best ${formatTime(row.official)}`;
}

/** One line of the timing tower; opens to show every run. */
function Row({ row, locked, leader }: { row: Standing; locked: boolean; leader: number | null }) {
  const gap = gapToLeader(row.best, leader);
  return (
    <details
      data-team={row.teamId}
      data-rank={row.rank ?? 0}
      className={`group border-b border-day-line/[0.08] bg-day-surface last:border-0 ${row.rank && !row.qualified ? "[&>summary]:opacity-75" : ""}`}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition-colors hover:bg-day-ink/[0.03] sm:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6rem_5.5rem_4.5rem_1rem] sm:gap-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col items-center gap-1">
          <PlaceBlock rank={row.rank} />
          <span className="day-delta day-num text-[0.7rem] font-bold leading-none" />
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <Crest name={row.name} size={24} ring={row.rank === 1} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-day-ink">{row.name}</span>
            <span className="day-num mt-0.5 block truncate text-[0.8125rem] text-day-muted sm:hidden">{sheetLine(row)}</span>
            {row.qualified ? (
              <span className="mt-0.5 hidden text-xs font-semibold text-day-good sm:block">{locked ? "Through to the knockout" : `In the top ${QUALIFIERS}`}</span>
            ) : !row.eligible ? (
              <span className="mt-0.5 hidden text-xs font-semibold text-day-faint sm:block">Not eligible</span>
            ) : !row.recorded ? (
              <span className="mt-0.5 hidden text-xs font-semibold text-day-faint sm:block">Yet to run</span>
            ) : null}
          </span>
        </span>
        <span className="hidden sm:block">
          <RunTicks log={row.log} />
          {row.recorded ? (
            <span className="day-num mt-1 block text-xs text-day-muted">
              {row.runs} of {row.runs + row.failed} reached
            </span>
          ) : (
            <span className="text-day-faint">–</span>
          )}
        </span>
        <span className="day-num hidden text-right text-day-ink sm:block">
          {row.official !== null ? formatTime(row.official) : row.remaining !== null ? <span className="text-day-muted">{formatReached(row.remaining)}</span> : "–"}
        </span>
        <span className="text-right">
          <span className={`day-num day-display block text-[1.6rem] leading-none sm:text-[1.75rem] ${row.rank === 1 ? "text-day-gold" : "text-day-ink"}`}>{formatPoints(row.best)}</span>
          <span className="day-num mt-1 block text-xs font-semibold text-day-faint sm:hidden">{gap}</span>
        </span>
        <span className="day-num hidden text-right text-sm font-semibold text-day-faint sm:block">{gap || (row.rank === 1 ? "leads" : "")}</span>
        <DayIcon name="more" className="hidden h-4 w-4 text-day-faint transition-transform duration-200 group-open:rotate-90 sm:block" />
      </summary>
      <div className="grid gap-4 border-t border-dashed border-day-line/[0.12] bg-day-sunk/60 px-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:px-5">
        <span className="hidden sm:block" />
        {row.recorded ? <SheetView times={row.times} remaining={row.remaining} log={row.log} score={row.best} /> : <p className="text-sm text-day-muted">No match sheet yet.</p>}
        <Link href={`/day/teams/${row.teamId}`} className="day-btn day-btn-soft day-btn-sm self-start">
          Team page
          <DayIcon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </details>
  );
}

/** Phase 1: the qualifying table as a timing tower, and the wall the top 32 have to clear. */
export default async function DayStandingsPage() {
  await requireDayViewer();
  const state = await loadPublicCompetition();
  const ranked = state.table.filter((row) => row.rank !== null);
  const unranked = state.table.filter((row) => row.rank === null);
  const cut = ranked[Math.min(QUALIFIERS, ranked.length) - 1];
  const locked = state.qualifyingStatus === "LOCKED";
  const leader = ranked[0]?.best ?? null;

  return (
    <div className="space-y-12">
      <PageHead
        kicker={`Phase 1 · ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus]}`}
        title="Qualifying"
        lead={
          state.qualifyingNote ||
          `Eight minutes each on the maze. Score = successful runs ÷ official time × 1000, the official time being the fastest run. The top ${QUALIFIERS} go through.`
        }
      />

      <HeldBack reveal={state.reveal} phases={[1]} />

      <Readout
        label="Qualifying in numbers"
        items={[
          { label: "Have run", value: state.table.filter((row) => row.recorded).length, hint: `of ${state.table.length} teams` },
          { label: "Top score", value: formatPoints(ranked[0]?.best), hint: ranked[0]?.name, tone: "gold" },
          { label: "Places in the knockout", value: QUALIFIERS, hint: "seeded 1 to 32", tone: "crimson" },
          {
            label: locked ? "Last score through" : "Score to beat for 32nd",
            value: ranked.length >= QUALIFIERS && cut ? formatPoints(cut.best) : "Open",
            hint: ranked.length < QUALIFIERS ? `${QUALIFIERS - ranked.length} place${QUALIFIERS - ranked.length === 1 ? "" : "s"} still unclaimed` : cut?.name,
            tone: "good",
          },
        ]}
      />

      {state.table.length ? (
        <section aria-label="The qualifying table">
          <div className="day-card day-posts">
            <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6rem_5.5rem_4.5rem_1rem] gap-4 border-b-2 border-day-line/85 px-5 py-3 text-[0.8125rem] font-semibold text-day-muted sm:grid">
              <span>Pos</span>
              <span>Team</span>
              <span>Runs</span>
              <span className="text-right">Official time</span>
              <span className="text-right">Score</span>
              <span className="text-right">Gap</span>
              <span />
            </div>
            <TowerMotion>
              {ranked.map((row) => (
                <Fragment key={row.teamId}>
                  <Row row={row} locked={locked} leader={leader} />
                  {row.rank === QUALIFIERS && ranked.length > QUALIFIERS ? (
                    <div className="relative flex items-center gap-3 bg-day-live/[0.05] px-3 py-2.5 sm:px-5" role="separator" aria-label="Qualification line">
                      <span className="day-wall flex-1 bg-day-live before:bg-day-live after:bg-day-live" aria-hidden="true" />
                      <span className="shrink-0 text-[0.8125rem] font-bold text-day-live">Top {QUALIFIERS} go through</span>
                      <span className="day-wall flex-1 bg-day-live before:bg-day-live after:bg-day-live" aria-hidden="true" />
                    </div>
                  ) : null}
                </Fragment>
              ))}
              {unranked.map((row) => (
                <Row key={row.teamId} row={row} locked={locked} leader={leader} />
              ))}
            </TowerMotion>
          </div>
        </section>
      ) : (
        <Empty title="No teams yet">Teams appear here once their registrations are confirmed.</Empty>
      )}
      <p className="text-center text-sm text-day-muted">
        Tap a row for every run. Ties go to the faster official time. ▲ and ▼ show how a place moved since you last looked.
      </p>
    </div>
  );
}
