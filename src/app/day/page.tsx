import Link from "next/link";
import { Countdown } from "@/components/brand/Countdown";
import { Crest } from "@/components/day-site/Crest";
import { MatchCard, SectionTitle, StatTile } from "@/components/day-site/ui";
import { QUALIFIERS, formatScore, phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { loadDaySite } from "@/lib/day-site";
import { clockTime, postedAgo } from "@/lib/day-mode";
import { shouldShowCountdown } from "@/lib/countdown";

export const revalidate = 30;

const EXPLORE = [
  { href: "/day/teams", title: "Teams", blurb: "Every team, its crest, its members and how far it has got." },
  { href: "/day/standings", title: "Standings", blurb: "The qualifying table and the line the top 32 have to clear." },
  { href: "/day/bracket", title: "Bracket", blurb: "From the round of 32 to the final, match by match." },
  { href: "/day/schedule", title: "Schedule", blurb: "The running order for the day, in Amman time." },
  { href: "/day/competitors", title: "Competitors", blurb: "Check-in, inspection, qualifying and what to bring." },
  { href: "/day/volunteers", title: "Volunteers", blurb: "Stations, shifts and who is where." },
  { href: "/day/organizers", title: "Organizers", blurb: "The committee, the desks and who to ask." },
  { href: "/day/venue", title: "Venue", blurb: "Where it is and how to find your way inside." },
];

/** The live hub: where the day is, what is on the maze, and everything else one tap away. */
export default async function DayLivePage() {
  const [state, site] = await Promise.all([loadCompetition(), loadDaySite()]);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? null) : null);

  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");
  const playable = state.bracket.filter((m) => m.teamAId && m.teamBId && !m.walkover);
  const live = playable.filter((m) => m.status === "LIVE");
  const waiting = playable.filter((m) => !m.winnerId && m.status !== "LIVE");
  const currentRound = waiting[0]?.round ?? live[0]?.round ?? null;
  const upNext = waiting.filter((m) => m.round === currentRound).slice(0, 4);
  const results = playable
    .filter((m) => m.winnerId)
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, 4);

  const scored = state.table.filter((row) => row.rank !== null);
  const checkedIn = state.competitors.filter((team) => team.checkedIn).length;
  const decided = playable.filter((m) => m.winnerId).length;

  const phaseLine = champion
    ? "The final is decided"
    : state.drawn && currentRound
      ? `Phase ${currentRound} · ${phaseInfo(currentRound).name}`
      : state.qualifyingStatus === "OPEN"
        ? "Phase 1 · Qualifying runs under way"
        : "Phase 1 · Qualifying opens soon";

  const countdown = shouldShowCountdown(site.eventDate) && site.eventDate;

  return (
    <div className="space-y-14">
      {/* ------------------------------------------------------------ hero */}
      <section className="day-glass day-rise relative overflow-hidden p-6 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[var(--day-rose)]/25 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-[var(--day-violet)]/20 blur-[110px]"
        />
        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="day-kicker flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-2 text-white">
                <span className="day-live-dot" aria-hidden="true" />
                Live
              </span>
              {site.dateText ? <span>{site.dateText}</span> : null}
              {site.venue ? <span className="text-white/60">{site.venue}</span> : null}
            </p>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-7xl">
              {site.headline}
            </h1>
            <p className="mt-5 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white sm:text-base">
              <span className="h-2 w-2 rounded-full bg-[var(--day-gold)] shadow-[0_0_12px_var(--day-gold)]" aria-hidden="true" />
              {phaseLine}
            </p>
            {site.intro ? <p className="mt-4 max-w-xl text-[var(--day-muted)]">{site.intro}</p> : null}
            {countdown ? (
              <div className="mt-6">
                <p className="day-kicker mb-2 text-white/60">Doors open in</p>
                <Countdown target={countdown} />
              </div>
            ) : null}
          </div>

          {champion ? (
            <Link
              href={`/day/teams/${champion.id}`}
              className="day-card day-glass flex items-center gap-5 border-[var(--day-gold)]/50 p-5"
            >
              <Crest name={champion.name} size={64} glow />
              <span className="min-w-0">
                <span className="day-kicker block">Champions</span>
                <span className="day-gradient-text day-shimmer mt-1 block font-display text-3xl font-extrabold leading-tight">
                  {champion.name}
                </span>
              </span>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Teams" value={state.competitors.length} />
              <StatTile label="Checked in" value={checkedIn} tone="mint" />
              <StatTile
                label={state.drawn ? "In the bracket" : "With a score"}
                value={state.drawn ? Math.min(scored.length, QUALIFIERS) : scored.length}
                tone="gold"
              />
              <StatTile label="Matches decided" value={decided} tone="rose" />
            </div>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- on the maze now */}
      {live.length || upNext.length ? (
        <section className="space-y-5">
          <SectionTitle
            kicker={live.length ? "Happening now" : "Coming up"}
            action={
              <Link href="/day/bracket" className="text-sm font-semibold text-[var(--day-gold)] hover:underline">
                Full bracket →
              </Link>
            }
          >
            {live.length ? "On the maze" : `Next in the ${phaseInfo(upNext[0]!.round).name}`}
          </SectionTitle>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {(live.length ? live : upNext).map((match) => (
              <MatchCard key={match.id} match={match} nameOf={nameOf} live={match.status === "LIVE"} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------- results and the table */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <SectionTitle kicker="Latest">Results</SectionTitle>
          {results.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {results.map((match) => (
                <MatchCard key={match.id} match={match} nameOf={nameOf} />
              ))}
            </div>
          ) : (
            <p className="day-glass p-5 text-[var(--day-muted)]">
              The first head-to-head results appear here once the knockout starts.
            </p>
          )}
        </div>

        <div className="space-y-5">
          <SectionTitle
            kicker="Phase 1"
            action={
              <Link href="/day/standings" className="text-sm font-semibold text-[var(--day-gold)] hover:underline">
                All {state.table.length} →
              </Link>
            }
          >
            Qualifying
          </SectionTitle>
          <ol className="day-glass divide-y divide-white/[0.06] overflow-hidden">
            {scored.slice(0, 8).map((row) => (
              <li key={row.teamId}>
                <Link href={`/day/teams/${row.teamId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04]">
                  <span
                    className={`w-7 text-center font-display text-lg font-extrabold tabular-nums ${
                      row.rank === 1 ? "text-[var(--day-gold)]" : "text-white/60"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <Crest name={row.name} size={22} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{row.name}</span>
                  <span className="font-mono text-sm tabular-nums text-white/85">{formatScore(row.best)}</span>
                </Link>
              </li>
            ))}
            {scored.length === 0 ? (
              <li className="px-4 py-5 text-[var(--day-muted)]">No runs recorded yet. The table fills in as teams run.</li>
            ) : null}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------ schedule and news */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <SectionTitle
            kicker="Times are Amman time"
            action={
              <Link href="/day/schedule" className="text-sm font-semibold text-[var(--day-gold)] hover:underline">
                Running order →
              </Link>
            }
          >
            Now and next
          </SectionTitle>
          {[site.focus, site.after].map((item, index) =>
            item ? (
              <div
                key={item.id}
                className={`day-glass p-5 ${index === 0 && item.state === "now" ? "border-[var(--day-rose)]/40" : ""}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--day-faint)]">
                  {index === 0 ? (item.state === "now" ? "Happening now" : "Up next") : "After that"}
                </p>
                <p className="mt-2 font-display text-xl font-extrabold text-white">{item.title}</p>
                <p className="mt-1 font-mono text-sm text-[var(--day-muted)]">
                  {clockTime(item.startsAt)}
                  {item.endsAt ? ` to ${clockTime(item.endsAt)}` : ""}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              </div>
            ) : null,
          )}
          {!site.focus ? (
            <p className="day-glass p-5 text-[var(--day-muted)]">The running order goes up here once it is set.</p>
          ) : null}
        </div>

        <div className="space-y-5">
          <SectionTitle
            kicker="From the desk"
            action={
              <Link href="/day/news" className="text-sm font-semibold text-[var(--day-gold)] hover:underline">
                All news →
              </Link>
            }
          >
            Announcements
          </SectionTitle>
          {site.announcements.length ? (
            <ul className="space-y-3">
              {site.announcements.slice(0, 4).map((item) => (
                <li
                  key={item.id}
                  className={`day-glass p-4 ${item.isPinned ? "border-[var(--day-gold)]/50 bg-[var(--day-gold)]/[0.07]" : ""}`}
                >
                  <p className="whitespace-pre-line leading-relaxed text-white/90">{item.body}</p>
                  <p className="mt-2 text-xs text-[var(--day-faint)]">
                    {item.isPinned ? <span className="mr-2 font-semibold uppercase text-[var(--day-gold)]">Pinned</span> : null}
                    {postedAgo(item.createdAt, site.now)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="day-glass p-5 text-[var(--day-muted)]">
              Nothing yet. Anything the desk needs you to know appears here, and the page keeps itself up to date.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ explore */}
      <section className="space-y-5">
        <SectionTitle kicker="Everything for the day">Find your way</SectionTitle>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXPLORE.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className="day-card day-glass day-rise group p-5"
              style={{ ["--i" as string]: index }}
            >
              <p className="font-display text-xl font-extrabold text-white">
                {item.title}
                <span className="ml-1 inline-block text-[var(--day-gold)] transition-transform group-hover:translate-x-1">
                  →
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--day-muted)]">{item.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {champion ? null : state.competitors.length ? (
        <p className="text-center text-sm text-[var(--day-faint)]">
          Following a team? Open{" "}
          <Link href="/day/teams" className="font-semibold text-white hover:underline">
            Teams
          </Link>{" "}
          and tap it for its members, its score and whether it has qualified.
        </p>
      ) : null}
    </div>
  );
}

