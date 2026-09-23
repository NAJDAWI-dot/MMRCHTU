import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Crest } from "@/components/day-site/Crest";
import { PageHead, StatTile } from "@/components/day-site/ui";
import { DIRECTION_LABELS, QUALIFIERS, QUALIFYING_STATUS_LABELS, formatScore } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";

export const revalidate = 30;
export const metadata: Metadata = { title: "Standings" };

const PODIUM = ["text-[var(--day-gold)]", "text-[#dfe4ec]", "text-[#e0a36b]"];

/** Phase 1: the qualifying table, and the line the top 32 have to clear. */
export default async function DayStandingsPage() {
  const state = await loadCompetition();
  const ranked = state.table.filter((row) => row.rank !== null);
  const unranked = state.table.filter((row) => row.rank === null);
  const cut = ranked[Math.min(QUALIFIERS, ranked.length) - 1];

  return (
    <div className="space-y-10">
      <PageHead
        kicker={`Phase 1 · ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus]}`}
        title="Qualifying"
        lead={
          state.qualifyingNote ||
          `Every team runs. The best run counts, and the top ${QUALIFIERS} go through to the knockout. ${DIRECTION_LABELS[state.qualifyingDirection]}.`
        }
      />

      <section className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <StatTile label="Teams with a score" value={ranked.length} hint={`of ${state.table.length}`} />
        <StatTile label="Places in the knockout" value={QUALIFIERS} tone="gold" />
        <StatTile
          label={state.qualifyingStatus === "LOCKED" ? "Last score through" : "Score to beat for 32nd"}
          value={ranked.length >= QUALIFIERS && cut ? formatScore(cut.best) : "Open"}
          hint={ranked.length < QUALIFIERS ? `${QUALIFIERS - ranked.length} places still unclaimed` : undefined}
          tone="mint"
        />
      </section>

      <section className="day-glass overflow-hidden">
        <table className="w-full">
          <caption className="sr-only">Qualifying standings</caption>
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-[0.14em] text-[var(--day-faint)]">
              <th scope="col" className="px-4 py-3 sm:px-6">
                Rank
              </th>
              <th scope="col" className="px-2 py-3">
                Team
              </th>
              <th scope="col" className="hidden px-2 py-3 text-right sm:table-cell">
                Runs
              </th>
              <th scope="col" className="px-4 py-3 text-right sm:px-6">
                Best
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <Fragment key={row.teamId}>
                <tr className={`border-b border-white/[0.05] ${row.qualified ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3 sm:px-6">
                    <span
                      className={`font-display text-xl font-extrabold tabular-nums ${PODIUM[(row.rank ?? 0) - 1] ?? "text-white/70"}`}
                    >
                      {row.rank}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/day/teams/${row.teamId}`} className="flex items-center gap-3 hover:underline">
                      <Crest name={row.name} size={26} glow={row.rank === 1} />
                      <span className="min-w-0 truncate font-semibold text-white">{row.name}</span>
                      {row.qualified ? (
                        <span className="hidden rounded-full bg-[var(--day-mint)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--day-mint)] sm:inline">
                          {state.qualifyingStatus === "LOCKED" ? "Through" : "In the top 32"}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="hidden px-2 py-3 text-right font-mono text-sm text-[var(--day-muted)] sm:table-cell">
                    {row.runs}
                  </td>
                  <td className="px-4 py-3 text-right font-display text-xl font-extrabold tabular-nums text-white sm:px-6">
                    {formatScore(row.best)}
                  </td>
                </tr>
                {row.rank === QUALIFIERS && ranked.length > QUALIFIERS ? (
                  <tr aria-hidden="true">
                    <td colSpan={4} className="px-4 py-0 sm:px-6">
                      <div className="flex items-center gap-3 py-2">
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--day-rose)] to-transparent" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--day-rose)]">
                          Qualification line
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--day-rose)] to-transparent" />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {unranked.map((row) => (
              <tr key={row.teamId} className="border-b border-white/[0.05] opacity-50">
                <td className="px-4 py-3 font-mono text-sm sm:px-6">–</td>
                <td className="px-2 py-3">
                  <Link href={`/day/teams/${row.teamId}`} className="flex items-center gap-3 hover:underline">
                    <Crest name={row.name} size={26} />
                    <span className="truncate font-semibold text-white">{row.name}</span>
                    <span className="text-xs text-[var(--day-faint)]">{row.eligible ? "Yet to run" : "Not eligible"}</span>
                  </Link>
                </td>
                <td className="hidden px-2 py-3 text-right font-mono text-sm sm:table-cell">{row.runs}</td>
                <td className="px-4 py-3 text-right font-mono sm:px-6">–</td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.table.length === 0 ? (
          <p className="p-6 text-[var(--day-muted)]">Teams appear here once their registrations are confirmed.</p>
        ) : null}
      </section>
    </div>
  );
}
