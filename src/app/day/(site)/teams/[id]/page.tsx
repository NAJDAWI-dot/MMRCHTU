import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { FollowButton } from "@/components/day-site/Follow";
import { JourneyBadge, MatchCard, Readout, SectionTitle, SheetView } from "@/components/day-site/ui";
import { INSPECTION_LABELS, QUALIFIERS, ordinal, phaseInfo } from "@/lib/bracket";
import { publicMembers } from "@/lib/competition";
import { loadPublicCompetition } from "@/lib/public-competition";
import { clockTime } from "@/lib/day-mode";
import { loadQueue } from "@/lib/day-queue";
import { formatPoints, formatTime } from "@/lib/score-sheet";
import { canViewDaySite, requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (!(await canViewDaySite())) return { title: "Team" };
  const state = await loadPublicCompetition();
  return { title: state.byId.get(params.id)?.name ?? "Team" };
}

/**
 * One team: who they are, whether they have qualified, every run they made
 * and every match they have played. Members are shown by name, university and
 * major only; nothing a team gave for contact purposes ever reaches this page.
 */
export default async function DayTeamPage({ params }: { params: { id: string } }) {
  await requireDayViewer();
  const state = await loadPublicCompetition();
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
      : standing?.recorded && standing.rank === null
        ? standing.qualified
          ? { tone: "good", icon: "check", title: "Going through", body: "Into the knockout. The scores are announced soon." }
          : { tone: "ink", icon: "lock", title: "Has run", body: "The results are announced soon. This page updates the moment they are." }
        : standing?.rank
        ? standing.qualified
          ? { tone: "gold", icon: "trophy", title: "On course to qualify", body: `${ordinal(standing.rank)} right now, inside the top ${QUALIFIERS}. Nothing is final until qualifying closes.` }
          : { tone: "live", icon: "timer", title: `Outside the top ${QUALIFIERS} for now`, body: `${ordinal(standing.rank)} right now.` }
        : { tone: "ink", icon: "timer", title: "Yet to run", body: "The table updates the moment this team's eight minutes are recorded." };

  const toneText: Record<Tone, string> = {
    good: "text-day-good",
    gold: "text-day-gold",
    live: "text-day-live",
    ink: "text-day-ink",
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

      {/* ------------------------------------------------------------ hero
          The team's own maze, large on the floor, and its name beside it. */}
      <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
        <div className="day-floor day-posts day-line-in mx-auto grid place-items-center p-7 sm:p-9 md:mx-0">
          <Crest name={team.name} size={150} ring={team.journey.state === "CHAMPION"} />
          <p className="mt-4 text-center text-xs font-semibold text-day-muted">Its crest: a maze drawn from its name</p>
        </div>
        <div className="min-w-0 text-center md:text-left">
          <p className="day-line-in flex items-center justify-center gap-2.5 text-[0.95rem] font-semibold text-day-crimson md:justify-start" style={{ ["--i" as string]: 1 }}>
            <span className="h-2 w-2 bg-day-crimson" aria-hidden="true" />
            {team.robotName ? `Robot ${team.robotName}` : "Team"}
          </p>
          <h1 className="day-display mt-3 break-words text-[clamp(2.6rem,7vw,5rem)] text-day-ink">
            <span className="day-rise">
              <span>{team.name}</span>
            </span>
          </h1>
          <div className="day-line-in mt-6 flex flex-wrap items-center justify-center gap-2 md:justify-start" style={{ ["--i" as string]: 2 }}>
            <JourneyBadge journey={team.journey} size="lg" />
            <FollowButton id={team.id} name={team.name} />
          </div>
          <ul className="day-line-in mt-4 flex flex-wrap justify-center gap-1.5 md:justify-start" style={{ ["--i" as string]: 3 }}>
            {chips.map((chip) => (
              <li key={chip.text} className={`day-chip min-h-[1.75rem] px-2.5 text-[0.8125rem] ${chip.tone}`}>
                {chip.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------ verdict and numbers */}
      <section className="space-y-4" data-reveal>
        <div className="flex items-start gap-4 border-y-2 border-day-line/85 py-5">
          <DayIcon name={verdict.icon} className={`mt-1 h-7 w-7 shrink-0 ${toneText[verdict.tone]}`} />
          <div>
            <p className="text-sm font-semibold text-day-muted">Qualification</p>
            <p className={`day-display mt-1 text-3xl sm:text-4xl ${verdict.tone === "ink" ? "text-day-ink" : toneText[verdict.tone]}`}>{verdict.title}</p>
            <p className="mt-2 max-w-[60ch] text-day-muted">{verdict.body}</p>
          </div>
        </div>
        <Readout
          label="This team in numbers"
          items={[
            { label: "Qualifying place", value: standing?.rank ? ordinal(standing.rank) : "–", tone: "gold" },
            { label: "Score", value: formatPoints(standing?.best), tone: "crimson" },
            { label: "Official time", value: formatTime(standing?.official), hint: "The fastest successful run" },
            { label: team.journey.seed ? `Seed ${team.journey.seed}` : "Knockout", value: wins, hint: `Match${wins === 1 ? "" : "es"} won`, tone: "good" },
          ]}
        />
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
        {/* ------------------------------------------------ the match sheet */}
        <div className="space-y-7">
          <SectionTitle kicker="Phase 1, run by run">The match sheet</SectionTitle>
          <div className="day-card day-posts p-6 sm:p-8" data-reveal>
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
                <div className="mt-6 border-t border-day-line/[0.1] pt-6">
                  <SheetView times={standing.times} remaining={standing.remaining} log={standing.log} score={standing.best} />
                </div>
                <p className="mt-6 text-[0.8125rem] leading-relaxed text-day-muted">
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
        <div className="space-y-7">
          <SectionTitle kicker={`${members.length} member${members.length === 1 ? "" : "s"}`}>The team</SectionTitle>
          <ul className="day-card day-posts divide-y divide-day-line/[0.08]" data-reveal>
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                <span className="day-display grid h-11 w-11 shrink-0 place-items-center rounded-[3px] bg-day-plum/10 text-base text-day-plum">
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
            {members.length === 0 ? <li className="p-4 text-day-muted">No members listed.</li> : null}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ bracket journey */}
      {path.length ? (
        <section className="space-y-7">
          <SectionTitle kicker="Phases 2 to 6, as the route runs">The road through the bracket</SectionTitle>
          <ol className="relative space-y-6 pl-8 sm:pl-10">
            <span aria-hidden="true" className="absolute bottom-2 left-[5px] top-3 w-[2px] bg-day-crimson" />
            {path.map((match) => (
              <li key={match.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-8 top-1 h-3 w-3 sm:-left-10 ${
                    match.winnerId === team.id ? "bg-day-good" : match.winnerId ? "bg-day-live" : "border-2 border-day-crimson bg-day-bg"
                  }`}
                />
                <p className="mb-2.5 text-sm font-semibold text-day-muted">
                  Phase {match.round} · {phaseInfo(match.round).name}
                  {match.winnerId ? (match.winnerId === team.id ? " · won" : " · lost") : ""}
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
