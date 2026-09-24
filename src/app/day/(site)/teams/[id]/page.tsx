import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { JourneyBadge, MatchCard, SectionTitle, SheetView, StatTile } from "@/components/day-site/ui";
import { INSPECTION_LABELS, QUALIFIERS, ordinal, phaseInfo } from "@/lib/bracket";
import { loadCompetition, publicMembers } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { loadQueue } from "@/lib/day-queue";
import { formatPoints, formatTime } from "@/lib/score-sheet";
import { canViewDaySite, requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (!(await canViewDaySite())) return { title: "Team" };
  const state = await loadCompetition();
  return { title: state.byId.get(params.id)?.name ?? "Team" };
}

/**
 * One team: who they are, whether they have qualified, every run they made
 * and every match they have played. Members are shown by name, university and
 * major only; nothing a team gave for contact purposes ever reaches this page.
 */
export default async function DayTeamPage({ params }: { params: { id: string } }) {
  await requireDayViewer();
  const state = await loadCompetition();
  const team = state.byId.get(params.id);
  if (!team) notFound();

  const [members, queue] = await Promise.all([publicMembers(team.id), loadQueue()]);
  const place = queue.active ? queue.placeOf(team.id) : null;
  const eta = queue.etaOf(team.id);
  const queueChip = !place
    ? null
    : place.kind === "now"
      ? { text: "On the maze now", tone: "text-day-live bg-day-live/10" }
      : place.kind === "on-deck"
        ? { text: `On deck${eta ? ` · ${eta}` : ""}`, tone: "text-day-gold bg-day-gold/15" }
        : place.kind === "in-hole"
          ? { text: `In the hole${eta ? ` · ${eta}` : ""}`, tone: "text-day-plum bg-day-plum/10" }
          : place.kind === "waiting"
            ? { text: `${place.ahead} teams before this one${eta ? ` · ${eta}` : ""}`, tone: "text-day-ink bg-day-ink/[0.06]" }
            : null;
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? null) : null);
  const path = state.bracket
    .filter((m) => (m.teamAId === team.id || m.teamBId === team.id) && !m.void)
    .sort((a, b) => a.round - b.round);
  const standing = team.standing;
  const wins = path.filter((m) => m.winnerId === team.id && !m.walkover).length;

  type Tone = "good" | "gold" | "live" | "ink";
  const verdict: { tone: Tone; icon: DayIconName; title: string; body: string } = state.drawn
    ? team.journey.seed !== null
      ? { tone: "good", icon: "check", title: "Qualified", body: `Seeded ${ordinal(team.journey.seed)} into the round of 32.` }
      : { tone: "ink", icon: "flag", title: "Did not qualify", body: `Only the top ${QUALIFIERS} from qualifying went through.` }
    : !team.eligible
      ? { tone: "live", icon: "close", title: "Not eligible to qualify", body: team.withdrawn ? "This team has withdrawn." : "This team did not pass the robot inspection." }
      : standing?.rank
        ? standing.qualified
          ? { tone: "gold", icon: "trophy", title: "On course to qualify", body: `${ordinal(standing.rank)} right now, inside the top ${QUALIFIERS}. Nothing is final until qualifying closes.` }
          : { tone: "live", icon: "timer", title: `Outside the top ${QUALIFIERS} for now`, body: `${ordinal(standing.rank)} right now.` }
        : { tone: "ink", icon: "timer", title: "Yet to run", body: "The table updates the moment this team's eight minutes are recorded." };

  const toneClass: Record<Tone, string> = {
    good: "bg-day-good/10 text-day-good",
    gold: "bg-day-gold/15 text-day-gold",
    live: "bg-day-live/10 text-day-live",
    ink: "bg-day-ink/[0.06] text-day-muted",
  };

  const chips = [
    queueChip,
    team.checkedIn
      ? { text: `Checked in${team.checkedInAt ? ` at ${clockTime(team.checkedInAt)}` : ""}`, tone: "text-day-good bg-day-good/10" }
      : { text: "Not checked in yet", tone: "text-day-muted bg-day-ink/[0.06]" },
    { text: INSPECTION_LABELS[team.inspection], tone: team.inspection === "PASSED" ? "text-day-good bg-day-good/10" : team.inspection === "FAILED" ? "text-day-live bg-day-live/10" : "text-day-muted bg-day-ink/[0.06]" },
    team.pit ? { text: `Pit ${team.pit}`, tone: "text-day-ink bg-day-ink/[0.06]" } : null,
    team.runOrder ? { text: `Runs ${ordinal(team.runOrder)} in qualifying`, tone: "text-day-plum bg-day-plum/10" } : null,
    team.withdrawn ? { text: "Withdrawn", tone: "text-day-live bg-day-live/10" } : null,
  ].filter((chip): chip is { text: string; tone: string } => chip !== null);

  return (
    <div className="space-y-16">
      <Link href="/day/teams" className="day-btn day-btn-soft day-btn-sm">
        <DayIcon name="back" className="h-4 w-4" />
        All teams
      </Link>

      {/* ------------------------------------------------------------ hero */}
      <section className="day-card relative overflow-hidden">
        <div className="day-stripe-x h-2" aria-hidden="true" />
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 p-6 sm:p-10 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="day-line-in flex justify-center md:justify-start">
            <Crest name={team.name} size={120} ring={team.journey.state === "CHAMPION"} />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <p className="day-kicker day-line-in" style={{ ["--i" as string]: 1 }}>
              {team.robotName ? `Robot · ${team.robotName}` : "Team"}
            </p>
            <h1 className="day-display day-line-in mt-3 break-words text-5xl text-day-ink sm:text-7xl" style={{ ["--i" as string]: 2 }}>
              {team.name}
            </h1>
            <div className="day-line-in mt-6 flex flex-wrap justify-center gap-2 md:justify-start" style={{ ["--i" as string]: 3 }}>
              <JourneyBadge journey={team.journey} size="lg" />
              {chips.map((chip) => (
                <span key={chip.text} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${chip.tone}`}>
                  {chip.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- verdict */}
      <section className="day-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8" data-reveal>
        <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${toneClass[verdict.tone]}`}>
          <DayIcon name={verdict.icon} className="h-8 w-8" />
        </span>
        <div>
          <p className="day-kicker">Qualification</p>
          <p className="day-display mt-2 text-3xl text-day-ink sm:text-4xl">{verdict.title}</p>
          <p className="mt-2 text-day-muted">{verdict.body}</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Qualifying rank" icon="standings" value={standing?.rank ? ordinal(standing.rank) : "–"} tone="gold" index={0} />
        <StatTile label="Score" icon="bolt" value={formatPoints(standing?.best)} tone="crimson" index={1} />
        <StatTile label="Official time" icon="timer" value={formatTime(standing?.official)} hint="The fastest successful run" index={2} />
        <StatTile
          label={team.journey.seed ? `Seed ${team.journey.seed}` : "Knockout"}
          icon="trophy"
          value={wins}
          hint={`Match${wins === 1 ? "" : "es"} won`}
          tone="good"
          index={3}
        />
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------ the match sheet */}
        <div className="space-y-6">
          <SectionTitle kicker="Phase 1">The match sheet</SectionTitle>
          <div className="day-card p-6 sm:p-8" data-reveal>
            {standing?.recorded ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-day-muted">Successful runs</p>
                    <p className="day-num day-display mt-1 text-5xl text-day-ink">
                      {standing.runs}
                      {standing.failed ? <span className="text-2xl text-day-faint"> of {standing.runs + standing.failed}</span> : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-day-muted">Score</p>
                    <p className="day-num day-display mt-1 text-5xl text-day-crimson">{formatPoints(standing.best)}</p>
                  </div>
                </div>
                <div className="mt-6 border-t border-day-line/[0.07] pt-6">
                  <SheetView times={standing.times} remaining={standing.remaining} log={standing.log} score={standing.best} />
                </div>
                <p className="mt-6 text-xs text-day-faint">
                  Score = successful runs ÷ official time × 1000. The official time, in gold, is the fastest run. Crossed runs did not reach the centre
                  and do not count.
                </p>
              </>
            ) : (
              <p className="text-day-muted">This team has not run yet. Its eight minutes appear here, run by run, once they are recorded.</p>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------- members */}
        <div className="space-y-6">
          <SectionTitle kicker={`${members.length} member${members.length === 1 ? "" : "s"}`}>The team</SectionTitle>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {members.map((member, index) => (
              <li key={member.id} className="day-card flex items-center gap-4 p-4" data-reveal style={{ ["--i" as string]: index }}>
                <span className="day-display grid h-12 w-12 shrink-0 place-items-center rounded-full bg-day-plum/10 text-lg text-day-plum">
                  {`${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-day-ink">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="block truncate text-sm text-day-muted">{[member.university, member.major].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
            {members.length === 0 ? <li className="day-card p-4 text-day-muted">No members listed.</li> : null}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ bracket journey */}
      {path.length ? (
        <section className="space-y-6">
          <SectionTitle kicker="Phases 2 to 6">The road through the bracket</SectionTitle>
          <ol className="relative space-y-5 border-l-2 border-day-line/10 pl-6 sm:pl-8">
            {path.map((match) => (
              <li key={match.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[33px] top-4 h-4 w-4 rounded-full border-4 border-day-bg sm:-left-[41px] ${
                    match.winnerId === team.id ? "bg-day-good" : match.winnerId ? "bg-day-live" : "bg-day-faint"
                  }`}
                />
                <p className="mb-2 text-sm font-semibold text-day-muted">
                  Phase {match.round} · {phaseInfo(match.round).name}
                </p>
                <MatchCard match={match} nameOf={nameOf} live={match.status === "LIVE"} highlight={team.id} arena={match.arena} showSheets />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
