import Link from "next/link";
import type { ReactNode } from "react";
import { Crest } from "@/components/day-site/Crest";
import { EmptyMouse, PeekingMouse } from "@/components/day-site/DayMice";
import { RunChips } from "@/components/day-site/RunChips";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { phaseInfo, type Journey, type ResolvedMatch } from "@/lib/bracket";
import type { GuideBlock } from "@/lib/day-guides";
import { clockTime } from "@/lib/day-mode";
import { heldBackLines, type Reveal } from "@/lib/reveal";
import { MAZE_CELLS, formatPoints, formatReached, outcomeText, scoreSheet, workingOf } from "@/lib/score-sheet";

/** A maze post: the small square where walls meet, used as a marker. */
export function Post({ className = "bg-day-crimson" }: { className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 ${className}`} aria-hidden="true" />;
}

/**
 * The heading every day page opens with: the title rising from behind its
 * wall, the line of context after it (never a label above it), and the wall
 * that closes the head off from the page.
 */
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
    <header className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 max-w-4xl">
          <h1 className="day-display text-[clamp(2.6rem,7vw,5.25rem)] text-day-ink">
            <span className="day-rise">
              <span>{title}</span>
            </span>
          </h1>
          <p className="day-line-in mt-5 flex items-center gap-2.5 text-[0.95rem] font-semibold text-day-crimson" style={{ ["--i" as string]: 1 }}>
            <Post />
            <span>{kicker}</span>
          </p>
          {lead ? (
            <p className="day-line-in mt-3 max-w-[62ch] text-pretty text-base leading-relaxed text-day-muted sm:text-[1.0625rem]" style={{ ["--i" as string]: 2 }}>
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
      <div data-reveal="wall" aria-hidden="true" className="relative">
        {/* A mouse looking over the wall, in the empty space a page head leaves on the right. */}
        {children ? null : <PeekingMouse page={title} />}
        <div className="day-wall" />
      </div>
    </header>
  );
}

/**
 * A section's title standing on a wall that runs out to the section's link.
 * The context, when there is some, reads after the title, never above it.
 */
export function SectionTitle({ kicker, children, action, id }: { kicker?: ReactNode; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div data-reveal="wall">
      <div className="flex items-end justify-between gap-4">
        <h2 id={id} className="day-display min-w-0 text-[1.7rem] text-day-ink sm:text-[2.15rem]">
          {children}
        </h2>
        {/* On a laptop the wall runs from the title out to the link. */}
        <div className="day-wall mb-[0.6rem] hidden flex-1 sm:block" aria-hidden="true" />
        {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
      </div>
      {/* On a phone there is no room beside the title, so it runs under it. */}
      <div className="day-wall mt-3 sm:hidden" aria-hidden="true" />
      {kicker ? <p className="mt-2 text-sm font-medium text-day-muted">{kicker}</p> : null}
    </div>
  );
}

/** "See all →", the way out of a section into its page. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold text-day-ink underline-offset-4 hover:underline"
    >
      {children}
      <DayIcon name="arrow" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
    </Link>
  );
}

const JOURNEY_TONES: Record<Journey["state"], string> = {
  REGISTERED: "bg-day-ink/[0.07] text-day-muted",
  QUALIFYING: "bg-day-plum/10 text-day-plum",
  NOT_QUALIFIED: "bg-day-ink/[0.07] text-day-faint",
  QUALIFIED: "bg-day-good/[0.12] text-day-good",
  ALIVE: "bg-day-good/[0.12] text-day-good",
  ELIMINATED: "bg-day-ink/[0.07] text-day-muted",
  RUNNER_UP: "bg-day-plum/10 text-day-plum",
  CHAMPION: "bg-day-gold/15 text-day-gold",
};

export function JourneyBadge({ journey, size = "sm" }: { journey: Journey; size?: "sm" | "lg" }) {
  return (
    <span className={`day-chip ${JOURNEY_TONES[journey.state]} ${size === "lg" ? "min-h-[2rem] px-3 text-sm" : ""}`}>
      {journey.state === "CHAMPION" ? <DayIcon name="trophy" className="h-3.5 w-3.5" /> : null}
      {journey.state === "ALIVE" ? <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" /> : null}
      {journey.label}
    </span>
  );
}

type Tone = "ink" | "gold" | "good" | "live" | "crimson";

const TONE_TEXT: Record<Tone, string> = {
  ink: "text-day-ink",
  gold: "text-day-gold",
  good: "text-day-good",
  live: "text-day-live",
  crimson: "text-day-crimson",
};

export interface ReadoutItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}

/**
 * A few numbers read together, like a scoreboard: one panel, the cells
 * divided by walls, a label over each number. Two across on a phone.
 */
export function Readout({ items, label }: { items: ReadoutItem[]; label?: string }) {
  const across = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"][Math.min(items.length, 4)];
  return (
    <dl aria-label={label} className={`day-card day-posts grid grid-cols-2 gap-px overflow-hidden bg-day-line/[0.12] ${across}`}>
      {items.map((item) => (
        <div key={item.label} className="bg-day-surface px-4 py-4 sm:px-5 sm:py-5">
          <dt className="text-[0.8125rem] font-semibold text-day-muted">{item.label}</dt>
          <dd className={`day-num day-display mt-1.5 text-[2.4rem] leading-none sm:text-5xl ${TONE_TEXT[item.tone ?? "ink"]}`}>{item.value}</dd>
          {item.hint ? <dd className="mt-2 truncate text-xs font-medium text-day-muted">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** One number on its own, for the desks. The public pages read numbers together in a Readout. */
export function StatTile({
  label,
  value,
  hint,
  tone = "ink",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: DayIconName;
  index?: number;
}) {
  return (
    <div className="day-card p-5">
      <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-day-muted">
        {icon ? <DayIcon name={icon} className="h-4 w-4" /> : null}
        {label}
      </p>
      <p className={`day-num day-display mt-2 text-4xl sm:text-5xl ${TONE_TEXT[tone]}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-day-muted">{hint}</p> : null}
    </div>
  );
}

/** Nothing here yet: said plainly, with the way on, and a mouse looking in to check. */
export function Empty({ title, children }: { icon?: DayIconName; title: string; children?: ReactNode }) {
  return (
    <div className="relative mt-9 rounded-[3px] border border-dashed border-day-line/25 px-6 pb-12 pt-14 text-center sm:pb-16" data-reveal>
      <EmptyMouse />
      <p className="day-display text-2xl text-day-ink">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-pretty leading-relaxed text-day-muted">{children}</div> : null}
    </div>
  );
}

/** A quiet note that some results on the page are still to be announced. */
export function HeldBack({ reveal, phases }: { reveal?: Reveal; phases: readonly number[] }) {
  const lines = heldBackLines(reveal, phases);
  if (!lines.length) return null;
  return (
    <div className="flex items-start gap-3.5 rounded-[3px] border border-day-gold/40 bg-day-gold/[0.07] p-4 sm:p-5" role="note" data-reveal>
      <DayIcon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-day-gold" />
      <div className="space-y-0.5">
        {lines.map((line) => (
          <p key={line} className="text-sm font-semibold text-day-ink">
            {line}
          </p>
        ))}
        <p className="text-[0.8125rem] text-day-muted">Keep this page open: it updates the moment they are revealed.</p>
      </div>
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
          <p className="text-sm text-day-muted">
            No run reached the centre. The furthest reached {formatReached(sheet.remaining)} of {MAZE_CELLS}.
          </p>
        ) : null
      ) : !compact ? (
        <p className="day-num text-sm text-day-muted">{workingOf(sheet)}</p>
      ) : null}
    </div>
  );
}

/**
 * Two teams, face to face, like a scoreboard: seeds, crests, names and the
 * score, the winner ticked in gold and the loser faded. A match on the maze
 * right now stands on the dark maze floor.
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
    <div className={`${live ? "day-floor" : "day-card"} day-posts`} data-reveal>
      <div className="flex items-center justify-between gap-3 border-b border-day-line/[0.1] px-4 py-2.5 text-[0.8125rem] font-semibold sm:px-5">
        <span className="flex min-w-0 items-center gap-2 text-day-muted">
          {live ? <span className="day-live-dot" aria-hidden="true" /> : null}
          <span className={`truncate ${live ? "text-day-live" : ""}`}>{live ? "On the maze now" : phaseInfo(match.round).name}</span>
          {time ? <span className="day-num shrink-0 text-day-faint">· {time}</span> : null}
          {arena ? <span className="shrink-0 text-day-faint">· {arena}</span> : null}
        </span>
        <span className="shrink-0 text-day-faint">
          {match.walkover ? "Bye" : match.winnerOverride ? "Judges' decision" : match.winnerId ? "Final" : `Match ${match.slot + 1}`}
        </span>
      </div>
      <div className="divide-y divide-day-line/[0.08]">
        {sides.map((side, index) => {
          const name = nameOf(side.id);
          const won = !!match.winnerId && match.winnerId === side.id;
          const lost = !!match.winnerId && !!side.id && match.winnerId !== side.id;
          return (
            <div key={index} data-team={side.id ?? undefined} className={`px-4 py-3 sm:px-5 ${highlight && side.id === highlight ? "bg-day-crimson/[0.05]" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="day-num w-5 shrink-0 text-right text-[0.8125rem] font-semibold text-day-faint" title={side.seed ? `Seed ${side.seed}` : undefined}>
                  {side.seed ?? ""}
                </span>
                {name ? (
                  <Crest name={name} size={24} ring={won && match.round === 6} />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-[3px] border border-dashed border-day-line/25" />
                )}
                <div className="min-w-0 flex-1">
                  {side.id && name ? (
                    <Link
                      href={`/day/teams/${side.id}`}
                      className={`block truncate text-[15px] underline-offset-2 hover:underline ${won ? "font-bold text-day-ink" : lost ? "font-medium text-day-faint" : "font-semibold text-day-ink"}`}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="block truncate text-[15px] italic text-day-faint">{match.round === 2 ? "Bye" : "To be decided"}</span>
                  )}
                  {side.seed ? <span className="sr-only">Seed {side.seed}</span> : null}
                </div>
                {won ? (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[2px] bg-day-gold text-day-on-ink" aria-label="Winner">
                    <DayIcon name="check" className="h-3 w-3" />
                  </span>
                ) : null}
                <span className={`day-num day-display min-w-[3.5ch] text-right text-[1.9rem] leading-none ${lost ? "text-day-faint" : "text-day-ink"}`}>
                  {match.walkover ? "" : formatPoints(side.score)}
                </span>
              </div>
              {showSheets && (side.times.length > 0 || side.remaining !== null || side.log.length > 0) ? (
                <div className="mt-3 pl-[4.25rem]">
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

/** A guide's blocks, in the day site's type: headings on walls, lists ruled and ticked. */
export function GuideView({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-7">
      {blocks.map((block, index) =>
        block.kind === "heading" ? (
          <div key={index} className="pt-8 first:pt-0">
            <SectionTitle>{block.text}</SectionTitle>
          </div>
        ) : block.kind === "list" ? (
          <ul key={index} className="grid max-w-5xl gap-x-10 border-t border-day-line/[0.12] sm:grid-cols-2" data-reveal>
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-3.5 border-b border-day-line/[0.12] py-3.5">
                <span className="mt-[0.2rem] grid h-[1.1rem] w-[1.1rem] shrink-0 place-items-center rounded-[2px] bg-day-good text-day-on-ink">
                  <DayIcon name="check" className="h-3 w-3" />
                </span>
                <span className="leading-relaxed text-day-ink">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="max-w-[65ch] text-pretty text-lg leading-relaxed text-day-muted" data-reveal>
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
