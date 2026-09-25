import type { Metadata } from "next";
import { Crest } from "@/components/day-site/Crest";
import { SponsorLogo } from "@/components/day-site/SponsorLogo";
import { DayIcon } from "@/components/day-site/icons";
import { QUALIFIERS, matchesInRound, phaseInfo } from "@/lib/bracket";
import { type BracketMatch } from "@/lib/competition";
import { loadPublicCompetition } from "@/lib/public-competition";
import { requireDayViewer } from "@/lib/day-access";
import { clockTime, postedAgo } from "@/lib/day-mode";
import { loadDayPhotos } from "@/lib/day-photos";
import { loadQueue } from "@/lib/day-queue";
import { loadDayShell } from "@/lib/day-shell";
import { loadDaySite } from "@/lib/day-site";
import { prisma } from "@/lib/prisma";
import { finalPlacings, roundLeaderboard, type RoundResult } from "@/lib/screen-boards";
import { groupByTier } from "@/lib/sponsors";
import { formatPoints, formatReached, formatTime } from "@/lib/score-sheet";
import { HallScreen, type ScreenPanel } from "./HallScreen";
import { recentReveal } from "@/lib/reveal";
import { revealShow } from "@/lib/reveal-show";
import { getCompetitionDayConfig } from "@/lib/site-config";

export const revalidate = 30;
export const metadata: Metadata = { title: "Hall screen", robots: { index: false } };

/**
 * The hall screen: the day on a projector, readable from the back row.
 *
 * Open it on the laptop driving the projector and press F. It cycles through
 * who is on the maze, the current phase's leaderboard, the day's schedule, the
 * bracket round, the latest photos, the news and the sponsors, and keeps
 * itself current. Same access as the day site: a signed-in
 * admin can run it before the day site goes public.
 */
export default async function HallScreenPage() {
  await requireDayViewer();
  const [state, site, queue, gallery, shell, sponsors, config] = await Promise.all([
    loadPublicCompetition(),
    loadDaySite(),
    loadQueue(),
    loadDayPhotos(5),
    loadDayShell(),
    prisma.sponsor.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, tier: true, logoUrl: true } }),
    getCompetitionDayConfig(),
  ]);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? null) : null);

  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");
  const playable = state.bracket.filter((m) => m.teamAId && m.teamBId && !m.walkover);
  const live = playable.filter((m) => m.status === "LIVE");
  const waiting = playable.filter((m) => !m.winnerId && m.status !== "LIVE");
  const currentRound = champion ? 6 : (live[0]?.round ?? waiting[0]?.round ?? null);
  const upNext = waiting.filter((m) => m.round === currentRound).slice(0, 4 - Math.min(live.length, 4));
  const ranked = state.table.filter((row) => row.rank !== null);
  const ran = state.table.filter((row) => row.recorded).length;

  const phaseLine = champion
    ? "The final is decided"
    : state.drawn && currentRound
      ? `Phase ${currentRound} · ${phaseInfo(currentRound).name}`
      : state.qualifyingStatus === "OPEN"
        ? `Phase 1 · Qualifying · ${ran} of ${state.competitors.length} have run`
        : "Phase 1 · Qualifying opens soon";

  const panels: ScreenPanel[] = [];

  // ------------------------------------------------------------------ now
  if (champion) {
    panels.push({
      key: "now",
      label: "Champions",
      node: (
        <div className="grid h-full place-items-center text-center">
          <div>
            <DayIcon name="trophy" className="mx-auto h-[9vh] w-[9vh] text-day-gold" />
            <p className="day-kicker mt-[4vh] text-[2.4vh]">Champions of MMRC 26</p>
            <div className="mt-[3vh] flex justify-center">
              <Crest name={champion.name} size={160} ring />
            </div>
            <p className="day-display mt-[4vh] text-[12vh] leading-none text-day-ink">{champion.name}</p>
          </div>
        </div>
      ),
    });
  } else if (live.length || upNext.length) {
    const shown = [...live, ...upNext].slice(0, 4);
    panels.push({
      key: "now",
      label: live.length ? "On the maze" : "Up next",
      node: (
        <div className="flex h-full flex-col">
          <PanelTitle kicker={live.length ? "Happening now" : "Up next"}>
            {live.length ? "On the maze" : `Next in the ${phaseInfo(shown[0]!.round).name}`}
          </PanelTitle>
          <div className={`mt-[3vh] grid min-h-0 flex-1 gap-[2.5vh] ${shown.length > 1 ? "grid-cols-2" : "grid-cols-1"} ${shown.length > 2 ? "grid-rows-2" : ""}`}>
            {shown.map((match) => (
              <MatchPanel key={match.id} match={match} nameOf={nameOf} big={shown.length === 1} />
            ))}
          </div>
        </div>
      ),
    });
  } else if (queue.active && (queue.queue.now || queue.queue.onDeck)) {
    const { now, onDeck, inHole } = queue.queue;
    const lead = now ?? onDeck!;
    const after = now ? [onDeck, inHole] : [inHole];
    panels.push({
      key: "now",
      label: now ? "On the maze" : "First up",
      node: (
        <div className="grid h-full grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-[3vh]">
          <div className={`day-card relative flex flex-col justify-center overflow-hidden p-[5vh] ${now ? "border-day-live" : ""}`}>
            <p className={`flex items-center gap-[1.2vh] text-[3vh] font-semibold ${now ? "text-day-live" : "text-day-muted"}`}>
              {now ? <span className="day-live-dot" aria-hidden="true" /> : null}
              {now ? "On the maze" : "First up"}
            </p>
            <div className="mt-[4vh] flex items-center gap-[4vh]">
              <Crest name={lead.name} size={150} />
              <p className="day-display min-w-0 break-words text-[11vh] leading-[0.95] text-day-ink">{lead.name}</p>
            </div>
            <p className="day-num mt-[4vh] text-[3vh] text-day-muted">
              Runs #{lead.runOrder}
              {now && queue.calledAt ? ` · called at ${clockTime(queue.calledAt)}` : !now ? ` · ${queue.etaOf(lead.id)}` : ""}
            </p>
            <div className="mt-[4vh]">
              <p className="text-[2vh] font-semibold text-day-muted">
                {queue.queue.ran} of {queue.queue.total} in the running order have run
              </p>
              <div className="mt-[1vh] h-[1vh] overflow-hidden bg-day-ink/10" aria-hidden="true">
                <div className="h-full bg-day-crimson" style={{ width: `${Math.round((queue.queue.ran / Math.max(1, queue.queue.total)) * 100)}%` }} />
              </div>
            </div>
          </div>
          <ol className="grid min-h-0 grid-cols-1 gap-[3vh]" style={{ gridTemplateRows: `repeat(${after.length}, minmax(0, 1fr))` }}>
            {after.map((entry, index) => {
              const label = now ? (index === 0 ? "On deck" : "In the hole") : "Then";
              return (
                <li key={label} className="day-card flex flex-col justify-center p-[4vh]">
                  <p className={`text-[2.6vh] font-semibold ${label === "On deck" ? "text-day-gold" : "text-day-plum"}`}>{label}</p>
                  {entry ? (
                    <>
                      <div className="mt-[2vh] flex items-center gap-[2.5vh]">
                        <Crest name={entry.name} size={72} />
                        <p className="day-display line-clamp-2 min-w-0 break-words text-[5.4vh] leading-[1.02] text-day-ink">{entry.name}</p>
                      </div>
                      <p className="day-num mt-[2vh] text-[2.4vh] text-day-muted">
                        #{entry.runOrder}
                        {queue.etaOf(entry.id) ? ` · ${queue.etaOf(entry.id)}` : ""}
                      </p>
                      {label === "On deck" ? <p className="mt-[1vh] text-[2.2vh] font-semibold text-day-ink">Bring your robot to the staging table</p> : null}
                    </>
                  ) : (
                    <p className="mt-[2vh] text-[3vh] text-day-muted">Nobody left after this</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ),
    });
  } else if (site.focus) {
    const focus = site.focus;
    panels.push({
      key: "now",
      label: focus.state === "now" ? "Now" : "Up next",
      node: (
        <div className="grid h-full grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-[3vh]">
          <div className="day-card flex flex-col justify-center p-[6vh]">
            <p className={`flex items-center gap-[1.2vh] text-[3vh] font-semibold ${focus.state === "now" ? "text-day-live" : "text-day-muted"}`}>
              {focus.state === "now" ? <span className="day-live-dot" aria-hidden="true" /> : null}
              {focus.state === "now" ? "Happening now" : "Up next"}
            </p>
            <p className="day-display mt-[3vh] text-[10vh] leading-[0.95] text-day-ink">{focus.title}</p>
            <p className="day-num mt-[3vh] text-[3.4vh] text-day-muted">
              {clockTime(focus.startsAt)}
              {focus.endsAt ? ` – ${clockTime(focus.endsAt)}` : ""}
              {focus.location ? ` · ${focus.location}` : ""}
            </p>
            {focus.description ? <p className="mt-[3vh] max-w-[80vh] text-[2.8vh] text-day-muted">{focus.description}</p> : null}
          </div>
          {site.after ? (
            <div className="day-card flex flex-col justify-center p-[5vh]">
              <p className="text-[2.6vh] font-semibold text-day-muted">After that</p>
              <p className="day-display mt-[2vh] text-[6vh] leading-none text-day-ink">{site.after.title}</p>
              <p className="day-num mt-[2vh] text-[2.8vh] text-day-muted">
                {clockTime(site.after.startsAt)}
                {site.after.location ? ` · ${site.after.location}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      ),
    });
  } else {
    panels.push({
      key: "now",
      label: "Welcome",
      node: (
        <div className="grid h-full place-items-center text-center">
          <div>
            <p className="font-brand text-[18vh] leading-none text-day-ink">MMRC 26</p>
            <p className="day-display mt-[3vh] text-[5.5vh] text-day-crimson">Competition day</p>
            {site.venue || site.dateText ? (
              <p className="mt-[4vh] text-[3vh] text-day-muted">{[site.dateText, site.venue].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
        </div>
      ),
    });
  }

  // ----------------------------------------------------------- leaderboard
  // The current phase's table: qualifying, the knockout round under way, or
  // the final placings once there are champions.
  type BoardRow = { key: string; rank: string; name: string; detail: string; score: string; tone: string; badge?: { text: string; className: string }; bar?: number };
  let board: { kicker: string; title: string; rows: BoardRow[] } | null = null;
  const RESULT_BADGE: Record<RoundResult, { text: string; className: string }> = {
    through: { text: "Through", className: "bg-day-good/15 text-day-good" },
    out: { text: "Out", className: "bg-day-ink/[0.07] text-day-faint" },
    live: { text: "On the maze", className: "bg-day-live/15 text-day-live" },
    "to-play": { text: "To play", className: "bg-day-ink/[0.07] text-day-muted" },
  };
  if (champion) {
    const PLACE = { 1: ["Champions", "text-day-gold"], 2: ["Runners-up", "text-day-ink"], 3: ["Semi-finalists", "text-day-plum"] } as const;
    board = {
      kicker: "MMRC 26",
      title: "Final standings",
      rows: finalPlacings(state.bracket).map((placing) => ({
        key: placing.teamId,
        rank: String(placing.place),
        name: nameOf(placing.teamId) ?? "",
        detail: PLACE[placing.place][0],
        score: "",
        tone: PLACE[placing.place][1],
      })),
    };
  } else if (state.drawn && currentRound) {
    const rows = roundLeaderboard(state.bracket, currentRound);
    const decidedInRound = state.bracket.filter((m) => m.round === currentRound && m.winnerId && !m.walkover && !m.void).length;
    const playedInRound = state.bracket.filter((m) => m.round === currentRound && !m.walkover && !m.void).length;
    let place = 0;
    if (rows.some((row) => row.score !== null || row.result === "live")) {
      board = {
        kicker: `Phase ${currentRound} · ${decidedInRound} of ${playedInRound} matches decided`,
        title: `${phaseInfo(currentRound).name} leaderboard`,
        rows: rows.slice(0, 10).map((row) => ({
          key: row.teamId,
          rank: row.score !== null ? String(++place) : "–",
          name: nameOf(row.teamId) ?? "",
          detail: row.opponentId ? `vs ${nameOf(row.opponentId) ?? "–"}` : "",
          score: row.score !== null ? formatPoints(row.score) : "",
          tone: place === 1 && row.score !== null ? "text-day-gold" : "text-day-faint",
          badge: RESULT_BADGE[row.result],
        })),
      };
    }
  } else if (ranked.length) {
    const leader = ranked[0]?.best ?? null;
    board = {
      kicker: `Phase 1 · Qualifying · the top ${QUALIFIERS} go through`,
      title: "Leaderboard",
      rows: ranked.slice(0, 10).map((row) => ({
        key: row.teamId,
        rank: String(row.rank),
        name: row.name,
        detail: row.runs
          ? `${row.failed ? `${row.runs} of ${row.runs + row.failed} runs` : `${row.runs} ${row.runs === 1 ? "run" : "runs"}`} · best ${formatTime(row.official)}`
          : row.remaining !== null
            ? `No run reached the centre · furthest ${formatReached(row.remaining)}`
            : "No run reached the centre",
        score: formatPoints(row.best),
        tone: row.rank === 1 ? "text-day-gold" : "text-day-faint",
        bar: leader && row.best ? Math.max(4, Math.round((row.best / leader) * 100)) : undefined,
      })),
    };
  }
  if (board && board.rows.length) {
    const rows = board.rows;
    const columns = rows.length > 5 ? [rows.slice(0, 5), rows.slice(5)] : [rows];
    const perColumn = columns.length > 1 ? 5 : rows.length;
    panels.push({
      key: "leaderboard",
      label: "Leaderboard",
      node: (
        <div className="flex h-full flex-col">
          <PanelTitle kicker={board.kicker}>{board.title}</PanelTitle>
          <div className={`mt-[3vh] grid min-h-0 flex-1 gap-[3vh] ${columns.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {columns.map((column, index) => (
              <ol
                key={index}
                className="day-card grid grid-cols-1 divide-y divide-day-line/[0.07] overflow-hidden"
                style={{ gridTemplateRows: `repeat(${perColumn}, minmax(0, 1fr))` }}
              >
                {column.map((row) => (
                  <li key={row.key} className="flex min-h-0 items-center gap-[2.5vh] px-[3vh]">
                    <span className={`day-num day-display w-[6vh] shrink-0 text-center text-[5vh] ${row.tone}`}>{row.rank}</span>
                    <Crest name={row.name} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[3.2vh] font-semibold text-day-ink">{row.name}</span>
                      <span className="day-num block truncate text-[2vh] text-day-muted">{row.detail}</span>
                      {row.bar ? (
                        <span className="mt-[0.8vh] block h-[0.6vh] overflow-hidden bg-day-ink/[0.07]" aria-hidden="true">
                          <span className={`block h-full ${row.rank === "1" ? "bg-day-gold" : "bg-day-plum/70"}`} style={{ width: `${row.bar}%` }} />
                        </span>
                      ) : null}
                    </span>
                    {row.badge ? (
                      <span className={`shrink-0 rounded-[2px] px-[1.4vh] py-[0.5vh] text-[1.8vh] font-semibold ${row.badge.className}`}>{row.badge.text}</span>
                    ) : null}
                    {row.score ? <span className="day-num day-display shrink-0 text-[5vh] text-day-ink">{row.score}</span> : null}
                  </li>
                ))}
              </ol>
            ))}
          </div>
        </div>
      ),
    });
  }

  // -------------------------------------------------------------- schedule
  // The day's running order from the Competition Day screen: a window around
  // now, what is done dimmed, what is on now lit.
  if (site.timeline.length) {
    const firstOpen = site.timeline.findIndex((item) => item.state !== "past");
    const from = firstOpen === -1 ? Math.max(0, site.timeline.length - 8) : Math.max(0, Math.min(firstOpen - 2, site.timeline.length - 8));
    const items = site.timeline.slice(from, from + 8);
    // "today" in the timeline means later today, not on now: only "now" is live.
    const nextId = site.timeline.find((item) => item.state !== "past" && item.state !== "now")?.id;
    panels.push({
      key: "schedule",
      label: "Schedule",
      node: (
        <div className="flex h-full flex-col">
          <PanelTitle kicker={site.dateText || "Today"}>Schedule</PanelTitle>
          <ol className="day-card mt-[3vh] grid min-h-0 flex-1 grid-cols-1 divide-y divide-day-line/[0.07] overflow-hidden" style={{ gridTemplateRows: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => {
              const now = item.state === "now";
              const past = item.state === "past";
              return (
                <li key={item.id} className={`flex min-h-0 items-center gap-[3vh] px-[3.5vh] ${now ? "bg-day-live/[0.08]" : ""}`}>
                  <span className={`day-num w-[22vh] shrink-0 text-[3vh] font-semibold ${past ? "text-day-faint" : "text-day-ink"}`}>
                    {clockTime(item.startsAt)}
                    {item.endsAt ? ` – ${clockTime(item.endsAt)}` : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[3.4vh] font-semibold ${past ? "text-day-faint line-through decoration-day-faint/40" : "text-day-ink"}`}>{item.title}</span>
                    {item.location ? <span className="block truncate text-[2vh] text-day-muted">{item.location}</span> : null}
                  </span>
                  {now ? (
                    <span className="flex shrink-0 items-center gap-[1vh] rounded-[2px] bg-day-live/15 px-[1.6vh] py-[0.6vh] text-[2vh] font-semibold text-day-live">
                      <span className="day-live-dot" aria-hidden="true" />
                      Now
                    </span>
                  ) : past ? (
                    <DayIcon name="check" className="h-[3vh] w-[3vh] shrink-0 text-day-good" />
                  ) : item.id === nextId ? (
                    <span className="shrink-0 rounded-[2px] bg-day-ink/[0.07] px-[1.6vh] py-[0.6vh] text-[2vh] font-semibold text-day-ink">Next</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ),
    });
  }

  // --------------------------------------------------------------- bracket
  if (state.drawn && currentRound && !champion) {
    const round = state.bracket.filter((m) => m.round === currentRound && !m.void);
    const decided = round.filter((m) => m.winnerId).length;
    const columns = matchesInRound(currentRound) >= 8 ? 4 : matchesInRound(currentRound) >= 2 ? 2 : 1;
    panels.push({
      key: "bracket",
      label: "Bracket",
      node: (
        <div className="flex h-full flex-col">
          <PanelTitle kicker={`${decided} of ${round.length} decided`}>{phaseInfo(currentRound).name}</PanelTitle>
          <ul className="mt-[3vh] grid min-h-0 flex-1 auto-rows-fr gap-[1.8vh]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {round.map((match) => (
              <li key={match.id} className={`day-card flex min-h-0 flex-col justify-center gap-[0.6vh] px-[2.4vh] py-[1vh] ${match.status === "LIVE" ? "ring-2 ring-day-live/60" : ""}`}>
                {[
                  { id: match.teamAId, score: match.scoreA },
                  { id: match.teamBId, score: match.scoreB },
                ].map((side, index) => {
                  const won = !!match.winnerId && match.winnerId === side.id;
                  const lost = !!match.winnerId && !!side.id && match.winnerId !== side.id;
                  return (
                    <p key={index} className={`flex items-center justify-between gap-[1vh] ${columns === 4 ? "text-[2.1vh]" : "text-[3vh]"}`}>
                      <span className={`truncate font-semibold ${lost ? "text-day-faint" : "text-day-ink"}`}>
                        {nameOf(side.id) ?? (match.walkover ? "Bye" : "To be decided")}
                      </span>
                      <span className={`day-num shrink-0 ${won ? "font-bold text-day-good" : lost ? "text-day-faint" : "text-day-ink"}`}>
                        {match.walkover ? "" : formatPoints(side.score)}
                      </span>
                    </p>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  // ---------------------------------------------------------------- photos
  if (gallery.photos.length) {
    const [first, ...rest] = gallery.photos;
    panels.push({
      key: "photos",
      label: "Photos",
      node: (
        <div className={`grid h-full gap-[2vh] ${rest.length ? "grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
          <figure className="day-card relative min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={first!.url} alt={first!.caption || "The latest photo from the hall"} className="h-full w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-[3vh] pb-[2.5vh] pt-[8vh] text-white">
              <span className="block text-[2vh] font-semibold text-white/80">From the hall · {postedAgo(first!.createdAt, site.now)}</span>
              {first!.caption ? <span className="mt-[0.8vh] block text-[3.6vh] font-semibold">{first!.caption}</span> : null}
            </figcaption>
          </figure>
          {rest.length ? (
            <ul
              className={`grid min-h-0 gap-[2vh] ${rest.length === 4 ? "grid-cols-2" : "grid-cols-1"}`}
              style={{ gridTemplateRows: `repeat(${rest.length === 4 ? 2 : rest.length}, minmax(0, 1fr))` }}
            >
              {rest.map((photo) => (
                <li key={photo.id} className="day-card min-h-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || "A photo from the hall"} className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ),
    });
  }

  // ------------------------------------------------------------------ news
  if (site.announcements.length) {
    const items = site.announcements.slice(0, 3);
    panels.push({
      key: "news",
      label: "News",
      node: (
        <div className="flex h-full flex-col">
          <PanelTitle kicker="From the desk">News</PanelTitle>
          <ul className="mt-[3vh] grid min-h-0 flex-1 grid-cols-1 gap-[2.5vh]" style={{ gridTemplateRows: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => (
              <li key={item.id} className={`day-card flex min-h-0 flex-col justify-center overflow-hidden px-[4vh] py-[2vh] ${item.isPinned ? "ring-2 ring-day-gold/50" : ""}`}>
                <p className="flex items-center gap-[1.2vh] text-[1.9vh] font-semibold text-day-faint">
                  {item.tone === "URGENT" ? <span className="rounded-[2px] bg-day-live/10 px-[1.2vh] py-[0.3vh] text-day-live">Urgent</span> : null}
                  {postedAgo(item.createdAt, site.now)}
                </p>
                {item.title ? <p className="day-display mt-[1vh] truncate text-[4.4vh] leading-tight text-day-ink">{item.title}</p> : null}
                <p className={`mt-[0.8vh] line-clamp-2 ${item.title ? "text-[2.8vh] text-day-muted" : "text-[3.6vh] text-day-ink"}`}>{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }

  // -------------------------------------------------------------- sponsors
  if (sponsors.length) {
    const groups = groupByTier(sponsors);
    // Fewer sponsors, bigger logos; with tiers, the first tier leads.
    const size = (count: number) => (count <= 3 ? "h-[26vh] w-[40vh]" : count <= 8 ? "h-[19vh] w-[30vh]" : "h-[13vh] w-[21vh]");
    const tileFor = (index: number, count: number) => (groups.length === 1 ? size(count) : index === 0 ? size(Math.max(count, 4)) : size(Math.max(count, 9)));
    panels.push({
      key: "sponsors",
      label: "Sponsors",
      node: (
        <div className="flex h-full flex-col">
          <PanelTitle kicker="With thanks">Our sponsors</PanelTitle>
          <div className="mt-[3vh] flex min-h-0 flex-1 flex-col justify-center gap-[3.5vh] overflow-hidden">
            {groups.map((group, index) => (
              <div key={group.tier || "untiered"} role="group" aria-label={group.tier || "Sponsors"}>
                {group.tier ? <p className="day-kicker mb-[1.8vh] text-center text-[2vh]">{group.tier}</p> : null}
                <ul className="flex flex-wrap justify-center gap-[2.5vh]">
                  {group.sponsors.map((sponsor) => (
                    <li key={sponsor.id}>
                      <SponsorLogo name={sponsor.name} logoUrl={sponsor.logoUrl} className={`${tileFor(index, group.sponsors.length)} p-[2.4vh]`} nameClass="text-[3.4vh]" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  const alert = shell.alerts[0] ?? null;

  return (
    <HallScreen
      panels={panels}
      phaseLine={phaseLine}
      alert={alert ? { title: alert.title, body: alert.body, tone: alert.tone } : null}
      followUrl={shell.isPublic ? "mmrchtu.tech" : "mmrchtu.tech/day"}
      reveal={revealShow(state, recentReveal(config.lastReveal, Date.now()))}
    />
  );
}

function PanelTitle({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="day-kicker text-[2vh]">{kicker}</p>
      <h2 className="day-display mt-[1vh] text-[7vh] leading-none text-day-ink">{children}</h2>
    </div>
  );
}

function MatchPanel({ match, nameOf, big }: { match: BracketMatch; nameOf: (id: string | null) => string | null; big: boolean }) {
  const live = match.status === "LIVE";
  const sides = [
    { id: match.teamAId, seed: match.seedA, score: match.scoreA },
    { id: match.teamBId, seed: match.seedB, score: match.scoreB },
  ];
  return (
    <div className={`day-card flex min-h-0 flex-col justify-center overflow-hidden px-[4vh] py-[2.5vh] ${live ? "border-day-live" : ""}`}>
      <p className={`flex items-center gap-[1vh] text-[2.2vh] font-semibold ${live ? "text-day-live" : "text-day-muted"}`}>
        {live ? <span className="day-live-dot" aria-hidden="true" /> : null}
        {live ? "On the maze now" : `Match ${match.slot + 1}`}
        {match.arena ? <span className="text-day-faint">· {match.arena}</span> : null}
      </p>
      <div className="mt-[2vh] space-y-[2vh]">
        {sides.map((side, index) => {
          const name = nameOf(side.id) ?? "To be decided";
          return (
            <div key={index} className="flex items-center gap-[2.5vh]">
              <Crest name={name} size={big ? 96 : 56} />
              <span className="min-w-0 flex-1">
                <span className={`day-display block truncate leading-none text-day-ink ${big ? "text-[9vh]" : "text-[4.6vh]"}`}>{name}</span>
                {side.seed ? <span className="mt-[0.6vh] block text-[1.9vh] font-semibold text-day-faint">Seed {side.seed}</span> : null}
              </span>
              <span className={`day-num day-display text-day-ink ${big ? "text-[9vh]" : "text-[5vh]"}`}>{formatPoints(side.score)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
