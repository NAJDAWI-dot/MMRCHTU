import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/day-site/Crest";
import { JourneyBadge, MatchCard, SectionTitle, StatTile } from "@/components/day-site/ui";
import { INSPECTION_LABELS, QUALIFIERS, formatScore, ordinal, phaseInfo } from "@/lib/bracket";
import { loadCompetition, publicMembers } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { prisma } from "@/lib/prisma";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const state = await loadCompetition();
  return { title: state.byId.get(params.id)?.name ?? "Team" };
}

/**
 * One team: who they are, whether they have qualified, and every match they
 * have played. Members are shown by name and university only; nothing a team
 * gave for contact purposes ever reaches this page.
 */
export default async function DayTeamPage({ params }: { params: { id: string } }) {
  const state = await loadCompetition();
  const team = state.byId.get(params.id);
  if (!team) notFound();

  const [members, runs] = await Promise.all([
    publicMembers(team.id),
    prisma.qualifyingRun.findMany({
      where: { registrationId: team.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, score: true, createdAt: true, note: true },
    }),
  ]);

  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? null) : null);
  const path = state.bracket
    .filter((m) => (m.teamAId === team.id || m.teamBId === team.id) && !m.void)
    .sort((a, b) => a.round - b.round);
  const standing = team.standing;
  const qualified = team.journey.seed !== null || (!state.drawn && !!standing?.qualified);

  const verdict = state.drawn
    ? team.journey.seed !== null
      ? { tone: "mint" as const, title: "Qualified", body: `Seeded ${ordinal(team.journey.seed)} into the round of 32.` }
      : { tone: "white" as const, title: "Did not qualify", body: `Only the top ${QUALIFIERS} from qualifying went through.` }
    : standing?.rank
      ? standing.qualified
        ? { tone: "gold" as const, title: "On course to qualify", body: `${ordinal(standing.rank)} right now, inside the top ${QUALIFIERS}. Nothing is final until qualifying locks.` }
        : { tone: "rose" as const, title: "Outside the top 32 for now", body: `${ordinal(standing.rank)} right now. A better run can still change that.` }
      : { tone: "white" as const, title: "Yet to run", body: "The table updates as soon as this team's first run is recorded." };

  return (
    <div className="space-y-12">
      <Link href="/day/teams" className="text-sm font-semibold text-[var(--day-muted)] hover:text-white">
        ← All teams
      </Link>

      <section className="day-glass day-rise relative overflow-hidden p-6 sm:p-10">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full blur-[100px] ${
            team.journey.state === "CHAMPION" ? "bg-[var(--day-gold)]/30" : qualified ? "bg-[var(--day-mint)]/15" : "bg-[var(--day-violet)]/20"
          }`}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Crest name={team.name} size={96} glow />
          <div className="min-w-0">
            <p className="day-kicker">{team.robotName ? `Robot · ${team.robotName}` : "Team"}</p>
            <h1
              className={`mt-2 break-words font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl ${
                team.journey.state === "CHAMPION" ? "day-gradient-text day-shimmer" : "text-white"
              }`}
            >
              {team.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <JourneyBadge journey={team.journey} size="lg" />
              <span
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  team.checkedIn
                    ? "border-[var(--day-mint)]/40 bg-[var(--day-mint)]/10 text-[var(--day-mint)]"
                    : "border-white/15 bg-white/5 text-white/60"
                }`}
              >
                {team.checkedIn ? `Checked in${team.checkedInAt ? ` at ${clockTime(team.checkedInAt)}` : ""}` : "Not checked in yet"}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/75">
                {INSPECTION_LABELS[team.inspection]}
              </span>
              {team.pit ? (
                <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-white/75">
                  Pit {team.pit}
                </span>
              ) : null}
              {team.withdrawn ? (
                <span className="rounded-full border border-[var(--day-rose)]/40 bg-[var(--day-rose)]/10 px-4 py-1.5 text-sm font-semibold text-[var(--day-rose)]">
                  Withdrawn
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Qualifying rank" value={standing?.rank ? ordinal(standing.rank) : "–"} tone="gold" />
        <StatTile label="Best score" value={formatScore(standing?.best)} hint={runs.length ? `From ${runs.length} run${runs.length === 1 ? "" : "s"}` : "No runs yet"} />
        <StatTile label="Seed" value={team.journey.seed ?? "–"} tone="mint" />
        <StatTile
          label="Knockout"
          value={path.filter((m) => m.winnerId === team.id && !m.walkover).length}
          hint="Matches won"
          tone="rose"
        />
      </section>

      <section
        className={`day-glass p-6 ${
          verdict.tone === "mint"
            ? "border-[var(--day-mint)]/40"
            : verdict.tone === "gold"
              ? "border-[var(--day-gold)]/40"
              : verdict.tone === "rose"
                ? "border-[var(--day-rose)]/40"
                : ""
        }`}
      >
        <p className="day-kicker">Qualification</p>
        <p className="mt-2 font-display text-3xl font-extrabold text-white">{verdict.title}</p>
        <p className="mt-2 text-[var(--day-muted)]">{verdict.body}</p>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <SectionTitle kicker={`${members.length} member${members.length === 1 ? "" : "s"}`}>The team</SectionTitle>
          <ul className="grid gap-3">
            {members.map((member) => (
              <li key={member.id} className="day-glass flex items-center gap-4 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--day-violet)]/40 to-[var(--day-rose)]/30 font-display text-lg font-extrabold text-white">
                  {`${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-white">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="block truncate text-sm text-[var(--day-muted)]">
                    {[member.university, member.major].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
            {members.length === 0 ? <li className="day-glass p-4 text-[var(--day-muted)]">No members listed.</li> : null}
          </ul>
        </div>

        <div className="space-y-5">
          <SectionTitle kicker="Phase 1">Qualifying runs</SectionTitle>
          <ol className="day-glass divide-y divide-white/[0.06] overflow-hidden">
            {runs.map((run, index) => {
              const best = standing?.best === run.score;
              return (
                <li key={run.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-14 font-mono text-xs text-[var(--day-faint)]">Run {index + 1}</span>
                  <span className={`font-display text-2xl font-extrabold tabular-nums ${best ? "text-[var(--day-gold)]" : "text-white"}`}>
                    {formatScore(run.score)}
                  </span>
                  {best ? <span className="text-xs font-semibold uppercase text-[var(--day-gold)]">Best</span> : null}
                  <span className="ml-auto font-mono text-xs text-[var(--day-faint)]">{clockTime(run.createdAt)}</span>
                </li>
              );
            })}
            {runs.length === 0 ? <li className="px-4 py-5 text-[var(--day-muted)]">No runs recorded yet.</li> : null}
          </ol>
        </div>
      </section>

      {path.length ? (
        <section className="space-y-5">
          <SectionTitle kicker="Phases 2 to 6">The road through the bracket</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {path.map((match) => (
              <div key={match.id}>
                <p className="mb-2 text-sm font-semibold text-[var(--day-muted)]">
                  Phase {match.round} · {phaseInfo(match.round).name}
                </p>
                <MatchCard match={match} nameOf={nameOf} live={match.status === "LIVE"} highlight={team.id} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
