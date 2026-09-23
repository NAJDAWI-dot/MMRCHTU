import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { Empty, PageHead, SheetView, StatTile } from "@/components/day-site/ui";
import { QUALIFIERS, QUALIFYING_STATUS_LABELS, type Standing } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { formatCells, formatPoints, formatTime } from "@/lib/score-sheet";

export const revalidate = 30;
export const metadata: Metadata = { title: "Standings" };

const PODIUM = ["bg-day-gold text-day-on-ink", "bg-day-ink/70 text-day-on-ink", "bg-day-crimson/80 text-day-on-ink"];

/** One line of the timing sheet; opens to show every run. */
function Row({ row, locked }: { row: Standing; locked: boolean }) {
  const podium = row.rank && row.rank <= 3 ? PODIUM[row.rank - 1] : null;
  return (
    <details className={`group border-b border-day-line/[0.06] last:border-0 ${row.rank && !row.qualified ? "opacity-70" : ""}`}>
      <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-day-ink/[0.03] sm:grid-cols-[3rem_minmax(0,1fr)_5rem_7rem_6rem_1.5rem] sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          {row.rank ? (
            <span
              className={`day-num inline-grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm font-bold ${podium ?? "text-day-muted"}`}
            >
              {row.rank}
            </span>
          ) : (
            <span className="text-day-faint">–</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <Crest name={row.name} size={24} ring={row.rank === 1} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-day-ink">{row.name}</span>
            <span className="block text-xs text-day-muted sm:hidden">
              {row.recorded
                ? row.runs
                  ? `${row.runs} run${row.runs === 1 ? "" : "s"} · ${formatTime(row.official)}`
                  : row.remaining !== null
                    ? `Stopped ${formatCells(row.remaining)} short`
                    : "No run reached the centre"
                : row.eligible
                  ? "Yet to run"
                  : "Not eligible"}
            </span>
            {row.qualified ? (
              <span className="mt-0.5 hidden text-[11px] font-semibold text-day-good sm:block">{locked ? "Through to the knockout" : `In the top ${QUALIFIERS}`}</span>
            ) : !row.eligible ? (
              <span className="mt-0.5 hidden text-[11px] font-semibold text-day-faint sm:block">Not eligible</span>
            ) : !row.recorded ? (
              <span className="mt-0.5 hidden text-[11px] font-semibold text-day-faint sm:block">Yet to run</span>
            ) : null}
          </span>
        </span>
        <span className="day-num hidden text-right text-day-ink sm:block">{row.recorded ? row.runs : "–"}</span>
        <span className="day-num hidden text-right text-day-muted sm:block">
          {row.official !== null ? formatTime(row.official) : row.remaining !== null ? formatCells(row.remaining) : "–"}
        </span>
        <span className={`day-num day-display text-right text-2xl ${row.rank === 1 ? "text-day-gold" : "text-day-ink"}`}>{formatPoints(row.best)}</span>
        <DayIcon name="more" className="hidden h-4 w-4 text-day-faint transition-transform group-open:rotate-90 sm:block" />
      </summary>
      <div className="grid gap-4 px-4 pb-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-6">
        <span className="hidden sm:block" />
        {row.recorded ? <SheetView times={row.times} remaining={row.remaining} score={row.best} /> : <p className="text-sm text-day-muted">No match sheet yet.</p>}
        <Link href={`/day/teams/${row.teamId}`} className="day-btn day-btn-soft day-btn-sm self-start">
          Team page
          <DayIcon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </details>
  );
}

/** Phase 1: the qualifying table as a timing sheet, and the line the top 32 have to clear. */
export default async function DayStandingsPage() {
  const state = await loadCompetition();
  const ranked = state.table.filter((row) => row.rank !== null);
  const unranked = state.table.filter((row) => row.rank === null);
  const cut = ranked[Math.min(QUALIFIERS, ranked.length) - 1];
  const locked = state.qualifyingStatus === "LOCKED";

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

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Have run" icon="timer" value={state.table.filter((row) => row.recorded).length} hint={`of ${state.table.length} teams`} index={0} />
        <StatTile label="Top score" icon="bolt" value={formatPoints(ranked[0]?.best)} hint={ranked[0]?.name} tone="gold" index={1} />
        <StatTile label="Places in the knockout" icon="bracket" value={QUALIFIERS} tone="crimson" index={2} />
        <StatTile
          label={locked ? "Last score through" : "Score to beat for 32nd"}
          icon="flag"
          value={ranked.length >= QUALIFIERS && cut ? formatPoints(cut.best) : "Open"}
          hint={ranked.length < QUALIFIERS ? `${QUALIFIERS - ranked.length} places still unclaimed` : undefined}
          tone="good"
          index={3}
        />
      </section>

      {state.table.length ? (
        <section className="day-card overflow-hidden" data-reveal>
          <div className="hidden grid-cols-[3rem_minmax(0,1fr)_5rem_7rem_6rem_1.5rem] gap-3 border-b border-day-line/[0.08] px-6 py-3 text-xs font-semibold text-day-faint sm:grid">
            <span>Pos</span>
            <span>Team</span>
            <span className="text-right">Runs</span>
            <span className="text-right">Official time</span>
            <span className="text-right">Score</span>
            <span />
          </div>
          {ranked.map((row) => (
            <Fragment key={row.teamId}>
              <Row row={row} locked={locked} />
              {row.rank === QUALIFIERS && ranked.length > QUALIFIERS ? (
                <div className="flex items-center gap-3 bg-day-live/[0.05] px-4 py-2 sm:px-6" role="separator" aria-label="Qualification line">
                  <span className="h-px flex-1 bg-day-live/50" />
                  <span className="day-kicker text-[10px] text-day-live">Qualification line</span>
                  <span className="h-px flex-1 bg-day-live/50" />
                </div>
              ) : null}
            </Fragment>
          ))}
          {unranked.map((row) => (
            <Row key={row.teamId} row={row} locked={locked} />
          ))}
        </section>
      ) : (
        <Empty icon="standings" title="No teams yet">
          Teams appear here once their registrations are confirmed.
        </Empty>
      )}
      <p className="text-center text-sm text-day-faint">Tap a row for every run. Ties go to the faster official time.</p>
    </div>
  );
}
