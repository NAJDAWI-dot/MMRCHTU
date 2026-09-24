import Link from "next/link";
import type { ReactNode } from "react";
import { Crest } from "@/components/day-site/Crest";
import { RunChips } from "@/components/day-site/RunChips";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { phaseInfo, type Journey, type ResolvedMatch } from "@/lib/bracket";
import type { GuideBlock } from "@/lib/day-guides";
import { clockTime } from "@/lib/day-mode";
import { formatCells, formatPoints, outcomeText, scoreSheet, workingOf } from "@/lib/score-sheet";

/** The heading every day page opens with, arriving a line at a time. */
export function PageHead({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: ReactNode;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-3xl">
        <p className="day-kicker day-line-in">{kicker}</p>
        <h1 className="day-display mt-3 text-[2.6rem] text-day-ink sm:text-6xl lg:text-7xl">
          <span className="day-line-in" style={{ ["--i" as string]: 1 }}>
            {title}
          </span>
        </h1>
        {lead ? (
          <p className="day-line-in mt-5 max-w-2xl text-base leading-relaxed text-day-muted sm:text-lg" style={{ ["--i" as string]: 2 }}>
            {lead}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="day-line-in" style={{ ["--i" as string]: 3 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SectionTitle({ kicker, children, action }: { kicker?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3" data-reveal>
      <div>
        {kicker ? <p className="day-kicker">{kicker}</p> : null}
        <h2 className="day-display mt-2 text-3xl text-day-ink sm:text-4xl">{children}</h2>
      </div>
      {action}
    </div>
  );
}

/** "See all →", the way out of a section into its page. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-day-ink">
      {children}
      <DayIcon name="arrow" className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
    </Link>
  );
}

const JOURNEY_TONES: Record<Journey["state"], string> = {
  REGISTERED: "bg-day-ink/[0.06] text-day-muted",
  QUALIFYING: "bg-day-plum/10 text-day-plum",
  NOT_QUALIFIED: "bg-day-ink/[0.06] text-day-faint",
  QUALIFIED: "bg-day-good/10 text-day-good",
  ALIVE: "bg-day-good/10 text-day-good",
  ELIMINATED: "bg-day-ink/[0.06] text-day-muted",
  RUNNER_UP: "bg-day-plum/10 text-day-plum",
  CHAMPION: "bg-day-gold/15 text-day-gold",
};

export function JourneyBadge({ journey, size = "sm" }: { journey: Journey; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${JOURNEY_TONES[journey.state]} ${
        size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      {journey.state === "CHAMPION" ? <DayIcon name="trophy" className="h-3.5 w-3.5" /> : null}
      {journey.state === "ALIVE" ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {journey.label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "ink",
  icon,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "gold" | "good" | "live" | "crimson";
  icon?: DayIconName;
  index?: number;
}) {
  const colour = {
    ink: "text-day-ink",
    gold: "text-day-gold",
    good: "text-day-good",
    live: "text-day-live",
    crimson: "text-day-crimson",
  }[tone];
  return (
    <div className="day-card p-5" data-reveal style={{ ["--i" as string]: index }}>
      <p className="flex items-center gap-2 text-xs font-semibold text-day-muted">
        {icon ? <DayIcon name={icon} className="h-4 w-4" /> : null}
        {label}
      </p>
      <p className={`day-num day-display mt-3 text-4xl sm:text-5xl ${colour}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-day-muted">{hint}</p> : null}
    </div>
  );
}

/** Nothing here yet: said plainly, with the way on. */
export function Empty({ icon = "flag", title, children }: { icon?: DayIconName; title: string; children?: ReactNode }) {
  return (
    <div className="day-card flex flex-col items-center px-6 py-14 text-center" data-reveal>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-day-crimson/10 text-day-crimson">
        <DayIcon name={icon} className="h-7 w-7" />
      </span>
      <p className="day-display mt-5 text-2xl text-day-ink">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-day-muted">{children}</div> : null}
    </div>
  );
}

/**
 * A match sheet, shown: every run in order, the successful ones by their time
 * with the fastest picked out as the official time, the failed ones crossed,
 * and the sum that makes the score.
 */
export function SheetView({
  times,
  remaining,
  log,
  score,
  compact = false,
}: {
  times: number[];
  remaining: number | null;
  /** Every run, successful or not, when the sheet has them. */
  log?: unknown;
  /** A score from before run times were recorded, shown on its own. */
  score?: number | null;
  compact?: boolean;
}) {
  const sheet = scoreSheet({ times, remaining, log });
  if (!sheet.log.length && score !== null && score !== undefined) {
    return <p className="text-sm text-day-muted">Score {formatPoints(score)}.</p>;
  }
  if (!sheet.log.length) return <p className="text-sm text-day-muted">No run reached the centre.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-day-muted">{outcomeText(sheet)}</p>
      <RunChips log={sheet.log} official={sheet.official} />
      {sheet.score === null ? (
        sheet.remaining !== null ? (
          <p className="text-sm text-day-muted">No run reached the centre. The closest stopped {formatCells(sheet.remaining)} short.</p>
        ) : null
      ) : !compact ? (
        <p className="day-num text-sm text-day-muted">{workingOf(sheet)}</p>
      ) : null}
    </div>
  );
}

/**
 * Two teams, face to face, like a scoreboard: crests, names, seeds and the
 * score, with the winner in full ink and the loser faded.
 */
export function MatchCard({
  match,
  nameOf,
  live = false,
  highlight,
  arena,
  showSheets = false,
}: {
  match: ResolvedMatch & { scheduledAt?: Date | null };
  nameOf: (id: string | null) => string | null;
  live?: boolean;
  highlight?: string;
  arena?: string;
  showSheets?: boolean;
}) {
  const sides = [
    { id: match.teamAId, seed: match.seedA, score: match.scoreA, times: match.timesA, remaining: match.remainingA, log: match.runLogA },
    { id: match.teamBId, seed: match.seedB, score: match.scoreB, times: match.timesB, remaining: match.remainingB, log: match.runLogB },
  ];
  const time = match.scheduledAt && !match.winnerId ? clockTime(match.scheduledAt) : "";
  return (
    <div
      className={`day-card overflow-hidden ${live ? "ring-2 ring-day-live/50" : ""}`}
      data-reveal
    >
      <div className="flex items-center justify-between gap-3 border-b border-day-line/[0.07] px-5 py-3 text-xs font-semibold">
        <span className="flex items-center gap-2 text-day-muted">
          {live ? <span className="day-live-dot" aria-hidden="true" /> : null}
          <span className={live ? "text-day-live" : ""}>{live ? "On the maze now" : phaseInfo(match.round).name}</span>
          {time ? <span className="day-num text-day-faint">· {time}</span> : null}
          {arena ? <span className="text-day-faint">· {arena}</span> : null}
        </span>
        <span className="text-day-faint">
          {match.walkover ? "Bye" : match.winnerId ? "Final" : `Match ${match.slot + 1}`}
        </span>
      </div>
      <div className="divide-y divide-day-line/[0.06]">
        {sides.map((side, index) => {
          const name = nameOf(side.id);
          const won = !!match.winnerId && match.winnerId === side.id;
          const lost = !!match.winnerId && !!side.id && match.winnerId !== side.id;
          return (
            <div key={index} className={`px-5 py-3.5 ${highlight && side.id === highlight ? "bg-day-crimson/[0.05]" : ""}`}>
              <div className="flex items-center gap-3">
                {name ? (
                  <Crest name={name} size={26} ring={won && match.round === 6} />
                ) : (
                  <span className="h-[35px] w-[35px] shrink-0 rounded-[28%] border border-dashed border-day-line/20" />
                )}
                <div className="min-w-0 flex-1">
                  {side.id && name ? (
                    <Link
                      href={`/day/teams/${side.id}`}
                      className={`block truncate text-[15px] font-semibold hover:underline ${lost ? "text-day-faint" : "text-day-ink"}`}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="block truncate text-[15px] italic text-day-faint">
                      {match.round === 2 ? "Bye" : "To be decided"}
                    </span>
                  )}
                  {side.seed ? <span className="text-[11px] font-medium text-day-faint">Seed {side.seed}</span> : null}
                </div>
                {won ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-day-good text-day-on-ink" aria-label="Winner">
                    <DayIcon name="check" className="h-3 w-3" />
                  </span>
                ) : null}
                <span
                  className={`day-num day-display min-w-[3.5ch] text-right text-3xl ${
                    won ? "text-day-ink" : lost ? "text-day-faint" : "text-day-ink"
                  }`}
                >
                  {match.walkover ? "" : formatPoints(side.score)}
                </span>
              </div>
              {showSheets && (side.times.length > 0 || side.remaining !== null || side.log.length > 0) ? (
                <div className="mt-3 pl-[47px]">
                  <SheetView times={side.times} remaining={side.remaining} log={side.log} compact />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A guide's blocks, in the day site's type. */
export function GuideView({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) =>
        block.kind === "heading" ? (
          <h2 key={index} className="day-display pt-6 text-3xl text-day-ink first:pt-0" data-reveal>
            {block.text}
          </h2>
        ) : block.kind === "list" ? (
          <ul key={index} className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
            {block.items.map((item, i) => (
              <li key={i} className="day-card flex gap-3 p-4 text-day-muted" data-reveal style={{ ["--i" as string]: i }}>
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-day-good/15 text-day-good">
                  <DayIcon name="check" className="h-3 w-3" />
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="max-w-3xl text-lg leading-relaxed text-day-muted" data-reveal>
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
