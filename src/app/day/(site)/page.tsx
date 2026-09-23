import Link from "next/link";
import { Countdown } from "@/components/brand/Countdown";
import { CountUp } from "@/components/day-site/CountUp";
import { Crest } from "@/components/day-site/Crest";
import { ChapterLogo } from "@/components/day-site/DayNav";
import { HeroMaze } from "@/components/day-site/HeroMaze";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { Empty, MatchCard, MoreLink, SectionTitle } from "@/components/day-site/ui";
import { KNOCKOUT_ROUNDS, QUALIFIERS, matchesInRound, phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { shouldShowCountdown } from "@/lib/countdown";
import { clockTime, postedAgo } from "@/lib/day-mode";
import { loadDaySite } from "@/lib/day-site";
import { formatPoints, formatTime } from "@/lib/score-sheet";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;

const EXPLORE: { href: string; title: string; blurb: string; icon: DayIconName }[] = [
  { href: "/day/competitors", title: "Competitors", blurb: "Check-in, inspection, your eight minutes and what to bring.", icon: "flag" },
  { href: "/day/volunteers", title: "Volunteers", blurb: "Stations, shifts and who is where.", icon: "hand" },
  { href: "/day/organizers", title: "Organizers", blurb: "The committee, the desks and who to ask.", icon: "badge" },
  { href: "/day/venue", title: "Venue", blurb: "Where it is and how to find your way inside.", icon: "pin" },
];

/** How far through a slot of the running order we are, 0 to 1. */
function progressThrough(start: Date, end: Date | null | undefined, now: Date): number | null {
  if (!end) return null;
  const span = end.getTime() - start.getTime();
  if (span <= 0) return null;
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / span));
}

/** The live hub: the fanciest page on the site, and the one open all day. */
export default async function DayLivePage() {
  await requireDayViewer();
  const [state, site] = await Promise.all([loadCompetition(), loadDaySite()]);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? null) : null);

  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");
  const playable = state.bracket.filter((m) => m.teamAId && m.teamBId && !m.walkover);
  const live = playable.filter((m) => m.status === "LIVE");
  const waiting = playable.filter((m) => !m.winnerId && m.status !== "LIVE");
  const currentRound = champion ? 6 : (live[0]?.round ?? waiting[0]?.round ?? null);
  const upNext = waiting.filter((m) => m.round === currentRound).slice(0, 4);
  const results = playable
    .filter((m) => m.winnerId)
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, 4);

  const ranked = state.table.filter((row) => row.rank !== null);
  const ran = state.table.filter((row) => row.recorded).length;
  const leader = ranked[0]?.best ?? null;
  const checkedIn = state.competitors.filter((team) => team.checkedIn).length;
  const decided = playable.filter((m) => m.winnerId).length;
  const phase = champion ? 6 : state.drawn ? (currentRound ?? 2) : 1;

  const phaseLine = champion
    ? "The final is decided"
    : state.drawn && currentRound
      ? `Phase ${currentRound} · ${phaseInfo(currentRound).name}`
      : state.qualifyingStatus === "OPEN"
        ? `Phase 1 · Qualifying · ${ran} of ${state.competitors.length} teams have run`
        : "Phase 1 · Qualifying opens soon";

  const countdown = shouldShowCountdown(site.eventDate) && site.eventDate;
  const focusProgress = site.focus?.state === "now" ? progressThrough(site.focus.startsAt, site.focus.endsAt, site.now) : null;

  // Teams still in it at the start of each phase, for the road to the final.
  const road = [
    { phase: 1, label: "Qualifying", teams: state.competitors.length },
    ...KNOCKOUT_ROUNDS.map((round) => ({ phase: round, label: phaseInfo(round).name, teams: matchesInRound(round) * 2 })),
  ];

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* ----------------------------------------------------------- hero */}
      <section className="relative grid min-h-[calc(100svh-9rem)] grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <p className="day-line-in flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-2 rounded-full bg-day-live/10 px-3 py-1.5 text-day-live">
              <span className="day-live-dot" aria-hidden="true" />
              Live
            </span>
            {site.dateText ? (
              <span className="rounded-full border border-day-line/10 bg-day-surface/70 px-3 py-1.5 text-day-muted">{site.dateText}</span>
            ) : null}
            {site.venue ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-day-line/10 bg-day-surface/70 px-3 py-1.5 text-day-muted">
                <DayIcon name="pin" className="h-3.5 w-3.5" />
                {site.venue}
              </span>
            ) : null}
          </p>

          <h1 className="mt-8">
            <span className="day-line-in block font-brand text-[clamp(4.2rem,14vw,10.5rem)] leading-[0.86] text-day-ink" style={{ ["--i" as string]: 1 }}>
              MMRC 26
            </span>
            <span
              className="day-line-in day-display mt-4 block text-[clamp(1.6rem,4.2vw,3.4rem)] uppercase text-day-crimson"
              style={{ ["--i" as string]: 2, letterSpacing: "0.02em" }}
            >
              {site.headline && site.headline !== "Competition Day" ? site.headline : "Competition day"}
            </span>
          </h1>

          <div className="day-line-in mt-8 max-w-xl" style={{ ["--i" as string]: 3 }}>
            <p className="flex items-center gap-3 text-base font-semibold text-day-ink sm:text-lg">
              <span className="day-stripe h-6 w-1.5 rounded-full" aria-hidden="true" />
              {phaseLine}
            </p>
            {state.qualifyingStatus === "OPEN" && !state.drawn && state.competitors.length ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-day-ink/10" aria-hidden="true">
                <div className="day-stripe-x h-full rounded-full" style={{ width: `${Math.round((ran / state.competitors.length) * 100)}%` }} />
              </div>
            ) : null}
            {site.intro ? <p className="mt-5 leading-relaxed text-day-muted">{site.intro}</p> : null}
          </div>

          <div className="day-line-in mt-9 flex flex-wrap gap-3" style={{ ["--i" as string]: 4 }}>
            <Link href={state.drawn ? "/day/bracket" : "/day/standings"} className="day-btn day-btn-ink h-12 px-6 text-base">
              {state.drawn ? "Follow the bracket" : "Follow the standings"}
              <DayIcon name="arrow" className="h-4 w-4" />
            </Link>
            <Link href="/day/teams" className="day-btn day-btn-soft h-12 px-6 text-base">
              Find a team
            </Link>
          </div>

          {countdown ? (
            <div className="day-line-in mt-10" style={{ ["--i" as string]: 5 }}>
              <p className="day-kicker mb-3">Starts in</p>
              <Countdown target={countdown} />
            </div>
          ) : null}
        </div>

        <div className="relative" data-reveal="scale">
          {champion ? (
            <Link href={`/day/teams/${champion.id}`} className="day-card day-lift block overflow-hidden p-8 text-center sm:p-10">
              <div className="day-stripe-x absolute inset-x-0 top-0 h-2" aria-hidden="true" />
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-day-gold/15 text-day-gold">
                <DayIcon name="trophy" className="h-8 w-8" />
              </span>
              <p className="day-kicker mt-6">Champions of MMRC 26</p>
              <div className="mt-5 flex justify-center">
                <Crest name={champion.name} size={96} ring />
              </div>
              <p className="day-display mt-6 text-4xl text-day-ink sm:text-5xl">{champion.name}</p>
            </Link>
          ) : (
            <div className="day-card relative overflow-hidden p-6 sm:p-8">
              <div className="flex items-center justify-between text-xs font-semibold text-day-muted">
                <span className="day-kicker">The maze</span>
                <span className="day-num">10 × 10 · to the centre</span>
              </div>
              <HeroMaze className="mt-5 aspect-square w-full" />
              <p className="mt-5 text-sm leading-relaxed text-day-muted">
                Eight minutes each. Every run that reaches the centre counts, and the fastest sets the official time.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------- numbers */}
      <section aria-label="The day in numbers" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Teams competing", value: state.competitors.length, icon: "teams" as const, tone: "text-day-ink" },
          { label: "Checked in", value: checkedIn, icon: "check" as const, tone: "text-day-good" },
          { label: state.drawn ? "In the bracket" : "Have run", value: state.drawn ? Math.min(ranked.length, QUALIFIERS) : ran, icon: "timer" as const, tone: "text-day-crimson" },
          { label: "Matches decided", value: decided, icon: "flag" as const, tone: "text-day-gold" },
        ].map((stat, index) => (
          <div key={stat.label} className="day-card p-5 sm:p-6" data-reveal style={{ ["--i" as string]: index }}>
            <p className="flex items-center gap-2 text-xs font-semibold text-day-muted">
              <DayIcon name={stat.icon} className="h-4 w-4" />
              {stat.label}
            </p>
            <p className={`day-num day-display mt-4 text-5xl sm:text-6xl ${stat.tone}`}>
              <CountUp value={stat.value} />
            </p>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------- now on the maze */}
      <section className="space-y-6">
        <SectionTitle
          kicker={live.length ? "Happening now" : "Now and next"}
          action={<MoreLink href={live.length || upNext.length ? "/day/bracket" : "/day/schedule"}>{live.length || upNext.length ? "Full bracket" : "Running order"}</MoreLink>}
        >
          {live.length ? "On the maze" : upNext.length ? `Next in the ${phaseInfo(upNext[0]!.round).name}` : "Where the day is"}
        </SectionTitle>

        {live.length || upNext.length ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {(live.length ? live : upNext).map((match) => (
              <MatchCard key={match.id} match={match} nameOf={nameOf} live={match.status === "LIVE"} arena={match.arena} />
            ))}
          </div>
        ) : site.focus ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="day-card relative overflow-hidden p-6 sm:p-8" data-reveal>
              <p className={`flex items-center gap-2 text-sm font-semibold ${site.focus.state === "now" ? "text-day-live" : "text-day-muted"}`}>
                {site.focus.state === "now" ? <span className="day-live-dot" aria-hidden="true" /> : null}
                {site.focus.state === "now" ? "Happening now" : "Up next"}
              </p>
              <p className="day-display mt-4 text-4xl text-day-ink sm:text-5xl">{site.focus.title}</p>
              <p className="day-num mt-3 text-lg text-day-muted">
                {clockTime(site.focus.startsAt)}
                {site.focus.endsAt ? ` – ${clockTime(site.focus.endsAt)}` : ""}
                {site.focus.location ? ` · ${site.focus.location}` : ""}
              </p>
              {site.focus.description ? <p className="mt-4 max-w-xl text-day-muted">{site.focus.description}</p> : null}
              {focusProgress !== null ? (
                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-day-ink/10" aria-hidden="true">
                  <div className="h-full rounded-full bg-day-live" style={{ width: `${Math.round(focusProgress * 100)}%` }} />
                </div>
              ) : null}
            </div>
            {site.after ? (
              <div className="day-card p-6 sm:p-8" data-reveal style={{ ["--i" as string]: 1 }}>
                <p className="text-sm font-semibold text-day-muted">After that</p>
                <p className="day-display mt-4 text-2xl text-day-ink sm:text-3xl">{site.after.title}</p>
                <p className="day-num mt-3 text-day-muted">
                  {clockTime(site.after.startsAt)}
                  {site.after.location ? ` · ${site.after.location}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <Empty icon="schedule" title="The running order goes up soon">
            The organisers publish the day&rsquo;s timings here, and this page follows them as the day goes.
          </Empty>
        )}
      </section>

      {/* ----------------------------------------------- road to the final */}
      <section className="space-y-6">
        <SectionTitle kicker="Six phases" action={<MoreLink href="/day/bracket">The bracket</MoreLink>}>
          The road to the final
        </SectionTitle>
        {/* Revealed as one strip: on a phone it scrolls sideways, and a card
            waiting off to the side would never cross the viewport to appear. */}
        <ol
          className="day-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6"
          data-reveal
        >
          {road.map((step) => {
            const now = step.phase === phase;
            const done = step.phase < phase;
            return (
              <li
                key={step.phase}
                className={`day-card relative w-[62vw] shrink-0 snap-start overflow-hidden p-5 sm:w-auto ${now ? "ring-2 ring-day-crimson/60" : ""}`}
              >
                {now ? <div className="day-stripe-x absolute inset-x-0 top-0 h-1" aria-hidden="true" /> : null}
                <p className={`text-xs font-semibold ${now ? "text-day-crimson" : "text-day-faint"}`}>
                  Phase {step.phase}
                  {now ? " · now" : done ? " · done" : ""}
                </p>
                <p className={`day-display mt-3 text-xl ${done ? "text-day-faint" : "text-day-ink"}`}>{step.label}</p>
                <p className="day-num mt-6 text-3xl text-day-ink">
                  {step.teams}
                  <span className="ml-1 text-sm font-medium text-day-muted">{step.phase === 6 ? "finalists" : "teams"}</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-day-muted">{phaseInfo(step.phase).blurb}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------------ qualifying */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionTitle kicker="Phase 1" action={<MoreLink href="/day/standings">All {state.table.length}</MoreLink>}>
            Qualifying
          </SectionTitle>
          {ranked.length ? (
            <ol className="day-card divide-y divide-day-line/[0.06] overflow-hidden" data-reveal>
              {ranked.slice(0, 8).map((row) => (
                <li key={row.teamId}>
                  <Link href={`/day/teams/${row.teamId}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-day-ink/[0.03]">
                    <span
                      className={`day-num day-display w-8 text-center text-2xl ${row.rank === 1 ? "text-day-gold" : "text-day-faint"}`}
                    >
                      {row.rank}
                    </span>
                    <Crest name={row.name} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-day-ink group-hover:underline">{row.name}</span>
                      <span className="day-num block text-xs text-day-muted">
                        {row.runs ? `${row.runs} ${row.runs === 1 ? "run" : "runs"} · best ${formatTime(row.official)}` : "No run reached the centre"}
                      </span>
                      {leader && row.best ? (
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-day-ink/[0.06]" aria-hidden="true">
                          <span
                            className={`block h-full rounded-full ${row.rank === 1 ? "bg-day-gold" : "bg-day-plum/70"}`}
                            style={{ width: `${Math.max(4, Math.round((row.best / leader) * 100))}%` }}
                          />
                        </span>
                      ) : null}
                    </span>
                    <span className="day-num day-display text-2xl text-day-ink">{formatPoints(row.best)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <Empty icon="timer" title="No match sheets yet">
              The table fills in as each team finishes its eight minutes.
            </Empty>
          )}
        </div>

        <div className="space-y-6">
          <SectionTitle kicker="How it is scored">The formula</SectionTitle>
          <div className="day-card overflow-hidden p-6 sm:p-8" data-reveal>
            <p className="day-display text-2xl leading-snug text-day-ink sm:text-3xl">
              <span className="text-day-crimson">Score</span> = successful runs ÷ official time × 1000
            </p>
            <ul className="mt-6 space-y-3 text-day-muted">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-day-crimson" aria-hidden="true" />
                Every run that reaches the centre in the eight minutes counts.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-day-crimson" aria-hidden="true" />
                The official time is the fastest of those runs.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-day-crimson" aria-hidden="true" />
                Four runs with a best of 25 s scores 160.0; one run of 18 s scores 55.6.
              </li>
            </ul>
            <p className="mt-6 text-sm text-day-faint">The top {QUALIFIERS} go through to the knockout.</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- results and news */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionTitle kicker="Latest" action={results.length ? <MoreLink href="/day/bracket">Every match</MoreLink> : undefined}>
            Results
          </SectionTitle>
          {results.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {results.map((match) => (
                <MatchCard key={match.id} match={match} nameOf={nameOf} arena={match.arena} />
              ))}
            </div>
          ) : (
            <Empty icon="flag" title="No results yet">
              Head-to-head results land here the moment the knockout starts.
            </Empty>
          )}
        </div>

        <div className="space-y-6">
          <SectionTitle kicker="From the desk" action={site.announcements.length ? <MoreLink href="/day/news">All news</MoreLink> : undefined}>
            News
          </SectionTitle>
          {site.announcements.length ? (
            <ul className="space-y-3">
              {site.announcements.slice(0, 4).map((item, index) => (
                <li key={item.id} className="day-card p-5" data-reveal style={{ ["--i" as string]: index }}>
                  <p className="flex items-center gap-2 text-xs font-semibold text-day-faint">
                    {item.isPinned ? <span className="rounded-full bg-day-gold/15 px-2 py-0.5 text-day-gold">Pinned</span> : null}
                    {item.tone === "URGENT" ? <span className="rounded-full bg-day-live/10 px-2 py-0.5 text-day-live">Urgent</span> : null}
                    {postedAgo(item.createdAt, site.now)}
                  </p>
                  {item.title ? <p className="mt-2 font-semibold text-day-ink">{item.title}</p> : null}
                  <p className="mt-1.5 whitespace-pre-line leading-relaxed text-day-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="megaphone" title="Nothing from the desk yet">
              Anything the organisers need you to know pops up here as it happens.
            </Empty>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ find your way */}
      <section className="space-y-6">
        <SectionTitle kicker="Everything for the day">Find your way</SectionTitle>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXPLORE.map((item, index) => (
            <Link key={item.href} href={item.href} className="day-card day-lift group flex flex-col p-6" data-reveal style={{ ["--i" as string]: index }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-day-crimson/10 text-day-crimson">
                <DayIcon name={item.icon} className="h-6 w-6" />
              </span>
              <p className="day-display mt-8 text-2xl text-day-ink">{item.title}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-day-muted">{item.blurb}</p>
              <DayIcon name="arrow" className="mt-6 h-5 w-5 text-day-ink transition-transform duration-500 group-hover:translate-x-1.5" />
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ sign-off */}
      <section className="day-card relative overflow-hidden px-6 py-14 text-center sm:py-20" data-reveal>
        <div className="day-checker absolute inset-x-0 bottom-0 h-4 opacity-[0.07]" aria-hidden="true" />
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <ChapterLogo className="h-24 w-24" />
          <p className="day-kicker mt-6">Brought to you by</p>
          <p className="day-display mt-3 text-3xl text-day-ink sm:text-4xl">IEEE RAS HTU Student Chapter</p>
          <p className="mt-4 text-day-muted">
            Following a team? Open{" "}
            <Link href="/day/teams" className="font-semibold text-day-ink underline decoration-day-crimson/40 underline-offset-4">
              Teams
            </Link>{" "}
            and tap it for its members, every run it made and whether it went through.
          </p>
        </div>
      </section>
    </div>
  );
}
