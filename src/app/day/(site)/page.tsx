import Link from "next/link";
import { Crest } from "@/components/day-site/Crest";
import { DayCountdown } from "@/components/day-site/DayCountdown";
import { CellKey, DayCells, type DayCell } from "@/components/day-site/DayCells";
import { HeroMaze } from "@/components/day-site/HeroMaze";
import { DayIcon } from "@/components/day-site/icons";
import { FollowPicker } from "@/components/day-site/Follow";
import { Road } from "@/components/day-site/Road";
import { PlaceBlock, RunTicks, gapToLeader } from "@/components/day-site/Tower";
import { Empty, HeldBack, MatchCard, MoreLink, Post, SectionTitle } from "@/components/day-site/ui";
import { KNOCKOUT_ROUNDS, QUALIFIERS, matchesInRound, phaseInfo } from "@/lib/bracket";
import { loadPublicCompetition } from "@/lib/public-competition";
import { shouldShowCountdown } from "@/lib/countdown";
import { clockTime, postedAgo } from "@/lib/day-mode";
import { loadDaySite } from "@/lib/day-site";
import { loadQueue } from "@/lib/day-queue";
import { loadDayPhotos } from "@/lib/day-photos";
import { QueueCards } from "@/components/day-site/QueueCards";
import { formatPoints, formatTime } from "@/lib/score-sheet";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;

const EXPLORE: { href: string; title: string; blurb: string }[] = [
  { href: "/day/competitors", title: "Competitors", blurb: "Check-in, inspection, your eight minutes and what to bring." },
  { href: "/day/volunteers", title: "Volunteers", blurb: "Stations, shifts and who is where." },
  { href: "/day/organizers", title: "Organizers", blurb: "The committee, the desks and who to ask." },
  { href: "/day/venue", title: "Venue", blurb: "Where it is and how to find your way inside." },
];

/** How far through a slot of the running order we are, 0 to 1. */
function progressThrough(start: Date, end: Date | null | undefined, now: Date): number | null {
  if (!end) return null;
  const span = end.getTime() - start.getTime();
  if (span <= 0) return null;
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / span));
}

/**
 * The live page: where the day is, at a glance, and the way into everything.
 *
 * It opens on the state of play (the phase, and one cell for every team or
 * match in it) beside the maze itself, then what is on the maze now, the
 * road to the final, the qualifying tower, the latest results and news.
 */
export default async function DayLivePage() {
  await requireDayViewer();
  const [state, site, queue, gallery] = await Promise.all([loadPublicCompetition(), loadDaySite(), loadQueue(), loadDayPhotos(6)]);
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
  const phase = champion ? 6 : state.drawn ? (currentRound ?? 2) : 1;

  // The state of play, in words and in cells.
  const onMaze = queue.active ? queue.queue.now?.id : undefined;
  let title: string;
  let detail: string;
  let cells: DayCell[] = [];
  if (champion) {
    title = "The final is decided";
    detail = `${champion.name} are the champions of MMRC 26.`;
  } else if (state.drawn && currentRound) {
    const round = state.bracket.filter((m) => m.round === currentRound && !m.void);
    const decided = round.filter((m) => m.winnerId).length;
    title = phaseInfo(currentRound).name;
    detail = `Phase ${currentRound} · ${decided} of ${matchesInRound(currentRound)} matches decided${live.length ? ` · ${live.length} on the maze now` : ""}`;
    cells = round.map((m) => ({
      id: m.id,
      name: `${nameOf(m.teamAId) ?? "To be decided"} v ${nameOf(m.teamBId) ?? "To be decided"}`,
      state: m.winnerId ? "won" : m.status === "LIVE" ? "live" : "waiting",
    }));
  } else {
    title = state.qualifyingStatus === "OPEN" ? "Qualifying" : "Qualifying opens soon";
    detail =
      state.qualifyingStatus === "OPEN"
        ? `Phase 1 · ${ran} of ${state.competitors.length} teams have run · ${checkedIn} checked in`
        : `Phase 1 · ${state.competitors.length} teams · ${checkedIn} checked in`;
    const byOrder = [...state.competitors].sort((a, b) => (a.runOrder ?? 999) - (b.runOrder ?? 999) || a.name.localeCompare(b.name));
    cells = byOrder.map((team) => ({
      id: team.id,
      name: team.name,
      state: !team.eligible ? "out" : team.id === onMaze ? "live" : team.standing?.recorded ? "ran" : team.checkedIn ? "here" : "waiting",
    }));
  }

  // The call queue takes the "now" slot through qualifying, once there is someone to call.
  const showQueue = !live.length && !upNext.length && queue.active && !!(queue.queue.now || queue.queue.onDeck);

  const countdown = shouldShowCountdown(site.eventDate) && site.eventDate;
  const focusProgress = site.focus?.state === "now" ? progressThrough(site.focus.startsAt, site.focus.endsAt, site.now) : null;

  // Teams still in it at the start of each phase, for the road to the final.
  const road = [
    { phase: 1, label: "Qualifying", teams: state.competitors.length, blurb: phaseInfo(1).blurb },
    ...KNOCKOUT_ROUNDS.map((round) => ({ phase: round, label: phaseInfo(round).name, teams: matchesInRound(round) * 2, blurb: phaseInfo(round).blurb })),
  ];

  const [bigPhoto, ...smallPhotos] = gallery.photos.slice(0, 5);

  return (
    <div className="space-y-20 sm:space-y-28">
      {/* ----------------------------------------------------------- hero */}
      <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:min-h-[calc(100svh-10rem)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="day-line-in flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-day-muted" style={{ ["--i" as string]: 0 }}>
            <span className="inline-flex items-center gap-2 text-day-live">
              <span className="day-live-dot" aria-hidden="true" />
              Live
            </span>
            {site.dateText ? (
              <>
                <span className="h-1 w-1 bg-day-line/40" aria-hidden="true" />
                <span>{site.dateText}</span>
              </>
            ) : null}
            {site.venue ? (
              <>
                <span className="h-1 w-1 bg-day-line/40" aria-hidden="true" />
                <span>{site.venue}</span>
              </>
            ) : null}
          </p>

          <h1 className="mt-6">
            <span className="day-rise">
              <span className="whitespace-nowrap font-brand text-[clamp(3.4rem,13vw,6.4rem)] leading-[0.9] text-day-ink lg:text-[clamp(4rem,6.2vw,6.4rem)]">MMRC 26</span>
            </span>
            <span className="day-rise mt-3" style={{ ["--i" as string]: 1 }}>
              <span className="day-display text-[clamp(1.55rem,4vw,2.75rem)] text-day-crimson">
                {site.headline && site.headline !== "Competition Day" ? site.headline : "Competition day"}
              </span>
            </span>
          </h1>

          {/* The state of play. */}
          <div className="day-line-in mt-10 max-w-xl" style={{ ["--i" as string]: 2 }}>
            <div className="day-wall day-wall-quiet mb-6" aria-hidden="true" />
            <p className="day-display text-[1.65rem] text-day-ink sm:text-[2rem]">{title}</p>
            <p className="mt-1.5 font-medium text-day-muted">{detail}</p>
            {cells.length ? (
              <div className="mt-5 space-y-3">
                <DayCells cells={cells} size={cells.length > 24 ? 17 : 26} />
                <CellKey
                  items={
                    state.drawn
                      ? [
                          { state: "won", label: "Decided" },
                          { state: "live", label: "On the maze" },
                          { state: "waiting", label: "To come" },
                        ]
                      : [
                          { state: "ran", label: "Has run" },
                          { state: "live", label: "On the maze" },
                          { state: "here", label: "Checked in" },
                          { state: "waiting", label: "Not here yet" },
                        ]
                  }
                />
              </div>
            ) : null}
            {site.intro ? <p className="mt-6 leading-relaxed text-day-muted">{site.intro}</p> : null}
          </div>

          <div className="day-line-in mt-9 flex flex-wrap gap-3" style={{ ["--i" as string]: 3 }}>
            <Link href={state.drawn ? "/day/bracket" : "/day/standings"} className="day-btn day-btn-ink h-12 px-6 text-base">
              {state.drawn ? "Follow the bracket" : "Follow the standings"}
              <DayIcon name="arrow" className="h-4 w-4" />
            </Link>
            <Link href="/day/teams" className="day-btn day-btn-soft h-12 px-6 text-base">
              Find a team
            </Link>
          </div>

          {countdown ? (
            <div className="day-line-in mt-10" style={{ ["--i" as string]: 4 }}>
              <p className="mb-3 text-sm font-semibold text-day-muted">Starts in</p>
              <DayCountdown target={countdown} />
            </div>
          ) : null}
        </div>

        {/* The maze on its floor, or the champions once there are some. */}
        <div className="relative" data-reveal>
          {champion ? (
            <Link href={`/day/teams/${champion.id}`} className="day-floor day-posts group block overflow-hidden text-center">
              <div className="day-checker h-3 opacity-80" style={{ ["--size" as string]: "6px" }} aria-hidden="true" />
              <div className="px-8 py-12 sm:px-10 sm:py-16">
                <DayIcon name="trophy" className="mx-auto h-10 w-10 text-day-gold" />
                <p className="mt-5 text-sm font-semibold text-day-gold">Champions of MMRC 26</p>
                <div className="mt-6 flex justify-center">
                  <Crest name={champion.name} size={104} ring />
                </div>
                <p className="day-display mt-7 text-4xl text-day-ink group-hover:underline sm:text-5xl">{champion.name}</p>
              </div>
            </Link>
          ) : (
            <figure>
              <div className="day-floor day-posts p-5 sm:p-7">
                <HeroMaze className="aspect-square w-full" />
              </div>
              <figcaption className="mt-3 flex items-center justify-between gap-4 text-[0.8125rem] font-semibold text-day-muted">
                <span>The maze: 10 × 10 cells, the centre in gold</span>
                <span className="day-num shrink-0">8:00 a team</span>
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      {state.competitors.length ? <FollowPicker teams={state.competitors.map((team) => ({ id: team.id, name: team.name }))} /> : null}

      <HeldBack reveal={state.reveal} phases={Array.from({ length: phase }, (_, index) => index + 1)} />

      {/* ------------------------------------------------- now on the maze */}
      <section className="space-y-7">
        <SectionTitle
          kicker={live.length ? "Happening now" : showQueue ? `Qualifying · ${queue.queue.ran} of ${queue.queue.total} have run` : "Now and next"}
          action={
            <MoreLink href={live.length || upNext.length ? "/day/bracket" : showQueue ? "/day/standings" : "/day/schedule"}>
              {live.length || upNext.length ? "Full bracket" : showQueue ? "Standings" : "Running order"}
            </MoreLink>
          }
        >
          {live.length ? "On the maze" : upNext.length ? `Next in the ${phaseInfo(upNext[0]!.round).name}` : showQueue ? "The call queue" : "Where the day is"}
        </SectionTitle>

        {live.length || upNext.length ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {(live.length ? live : upNext).map((match) => (
              <MatchCard key={match.id} match={match} nameOf={nameOf} live={match.status === "LIVE"} arena={match.arena} />
            ))}
          </div>
        ) : showQueue ? (
          <QueueCards
            now={queue.queue.now}
            onDeck={queue.queue.onDeck}
            inHole={queue.queue.inHole}
            calledAt={queue.calledAt ? clockTime(queue.calledAt) : ""}
            onDeckEta={queue.queue.onDeck ? queue.etaOf(queue.queue.onDeck.id) : ""}
            inHoleEta={queue.queue.inHole ? queue.etaOf(queue.queue.inHole.id) : ""}
          />
        ) : site.focus ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className={`${site.focus.state === "now" ? "day-floor" : "day-card"} day-posts p-6 sm:p-8`} data-reveal>
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
                <div className="mt-6 h-1.5 bg-day-line/[0.15]" aria-hidden="true">
                  <div className="h-full bg-day-live" style={{ width: `${Math.round(focusProgress * 100)}%` }} />
                </div>
              ) : null}
            </div>
            {site.after ? (
              <div className="day-card day-posts p-6 sm:p-8" data-reveal style={{ ["--i" as string]: 1 }}>
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
          <Empty title="The running order goes up soon">
            The organisers publish the day&rsquo;s timings here, and this page follows them as the day goes.
          </Empty>
        )}
      </section>

      {/* ----------------------------------------------- road to the final */}
      <section className="space-y-10">
        <SectionTitle kicker="Six phases, forty teams to one" action={<MoreLink href="/day/bracket">The bracket</MoreLink>}>
          The road to the final
        </SectionTitle>
        <Road steps={road} current={phase} />
      </section>

      {/* ------------------------------------------------------ qualifying */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-7">
          <SectionTitle kicker="Phase 1, the top eight" action={<MoreLink href="/day/standings">All {state.table.length}</MoreLink>}>
            Qualifying
          </SectionTitle>
          {ranked.length ? (
            <ol className="day-card day-posts divide-y divide-day-line/[0.08]" data-reveal>
              {ranked.slice(0, 8).map((row) => (
                <li key={row.teamId} data-team={row.teamId}>
                  <Link href={`/day/teams/${row.teamId}`} className="group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-day-ink/[0.03] sm:gap-4 sm:px-5">
                    <PlaceBlock rank={row.rank} />
                    <Crest name={row.name} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-day-ink underline-offset-2 group-hover:underline">{row.name}</span>
                      <span className="mt-1 flex items-center gap-2.5 text-[0.8125rem] text-day-muted">
                        <RunTicks log={row.log} />
                        <span className="day-num truncate">{row.runs ? `best ${formatTime(row.official)}` : "no run reached the centre"}</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`day-num day-display block text-[1.7rem] leading-none ${row.rank === 1 ? "text-day-gold" : "text-day-ink"}`}>{formatPoints(row.best)}</span>
                      <span className="day-num mt-1 block text-xs font-semibold text-day-faint">{gapToLeader(row.best, leader) || (row.rank === 1 ? "leads" : "")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No match sheets yet">The table fills in as each team finishes its eight minutes.</Empty>
          )}
        </div>

        <div className="space-y-7">
          <SectionTitle kicker="How a place is earned">The formula</SectionTitle>
          <div className="day-card day-posts p-6 sm:p-8" data-reveal>
            <p className="day-display text-[1.6rem] leading-[1.15] text-day-ink sm:text-[1.9rem]">
              <span className="text-day-crimson">Score</span> = successful runs ÷ official time × 1000
            </p>
            <ul className="mt-6 space-y-3 text-day-muted">
              {[
                "Every run that reaches the centre in the eight minutes counts.",
                "The official time is the fastest of those runs.",
                "Ties go to the faster official time.",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <Post className="mt-[0.45rem] bg-day-crimson" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="day-sunk mt-6 px-4 py-3">
              <p className="text-[0.8125rem] font-semibold text-day-muted">For example</p>
              <p className="day-num mt-1 text-day-ink">4 runs, best 25.0 s: 4 ÷ 25.0 × 1000 = 160.0</p>
              <p className="day-num text-day-ink">1 run of 18.0 s: 1 ÷ 18.0 × 1000 = 55.6</p>
            </div>
            <p className="mt-5 text-sm font-medium text-day-muted">The top {QUALIFIERS} go through to the knockout.</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- results and news */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-7">
          <SectionTitle kicker="Latest from the knockout" action={results.length ? <MoreLink href="/day/bracket">Every match</MoreLink> : undefined}>
            Results
          </SectionTitle>
          {results.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
              {results.map((match) => (
                <MatchCard key={match.id} match={match} nameOf={nameOf} arena={match.arena} />
              ))}
            </div>
          ) : (
            <Empty title="No results yet">Head-to-head results land here the moment the knockout starts.</Empty>
          )}
        </div>

        <div className="space-y-7">
          <SectionTitle kicker="From the organisers' desk" action={site.announcements.length ? <MoreLink href="/day/news">All news</MoreLink> : undefined}>
            News
          </SectionTitle>
          {site.announcements.length ? (
            <ul className="day-card day-posts divide-y divide-day-line/[0.08]" data-reveal>
              {site.announcements.slice(0, 4).map((item) => (
                <li key={item.id} className="px-5 py-4 sm:px-6 sm:py-5">
                  <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-semibold text-day-faint">
                    {item.isPinned ? <span className="day-chip bg-day-gold/15 text-day-gold">Pinned</span> : null}
                    {item.tone === "URGENT" ? <span className="day-chip bg-day-live/10 text-day-live">Urgent</span> : null}
                    <span className="day-num">{postedAgo(item.createdAt, site.now)}</span>
                  </p>
                  {item.title ? <p className="mt-2 font-bold text-day-ink">{item.title}</p> : null}
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-day-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing from the desk yet">Anything the organisers need you to know pops up here as it happens.</Empty>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ from the hall */}
      {bigPhoto ? (
        <section className="space-y-7">
          <SectionTitle kicker="Taken in the hall today" action={<MoreLink href="/day/photos">All {gallery.count} photos</MoreLink>}>
            Photos
          </SectionTitle>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-reveal>
            {[bigPhoto, ...smallPhotos].map((photo, index) => (
              <li key={photo.id} className={index === 0 ? "col-span-2 row-span-2" : ""}>
                <Link href="/day/photos" className="group block h-full overflow-hidden rounded-[3px] bg-day-ink/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || "A photo from the hall"}
                    width={photo.width ?? undefined}
                    height={photo.height ?? undefined}
                    loading="lazy"
                    className="aspect-square h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------ find your way */}
      <section className="space-y-7">
        <SectionTitle kicker="Everything else for the day">Find your way</SectionTitle>
        <ul className="border-t-2 border-day-line/85" data-reveal>
          {EXPLORE.map((item) => (
            <li key={item.href} className="border-b border-day-line/[0.14]">
              <Link
                href={item.href}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-5 transition-colors hover:bg-day-ink/[0.03] sm:px-2 md:grid-cols-[16rem_minmax(0,1fr)_auto]"
              >
                <span className="day-display text-[1.6rem] text-day-ink transition-colors group-hover:text-day-crimson sm:text-[1.9rem]">{item.title}</span>
                <span className="order-3 col-span-2 text-day-muted md:order-none md:col-span-1">{item.blurb}</span>
                <DayIcon name="arrow" className="h-5 w-5 text-day-ink transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
