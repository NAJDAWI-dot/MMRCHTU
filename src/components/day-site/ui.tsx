import Link from "next/link";
import type { ReactNode } from "react";
import { Crest } from "@/components/day-site/Crest";
import { formatScore, phaseInfo, type Journey, type ResolvedMatch } from "@/lib/bracket";
import type { GuideBlock } from "@/lib/day-guides";

/** The heading every day page opens with. */
export function PageHead({ kicker, title, lead, children }: { kicker: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="day-rise flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-3xl">
        <p className="day-kicker">{kicker}</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
          {title}
        </h1>
        {lead ? <p className="mt-4 text-base text-[var(--day-muted)] sm:text-lg">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ kicker, children, action }: { kicker?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? <p className="day-kicker">{kicker}</p> : null}
        <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{children}</h2>
      </div>
      {action}
    </div>
  );
}

const JOURNEY_TONES: Record<Journey["state"], string> = {
  REGISTERED: "border-white/15 bg-white/5 text-white/70",
  QUALIFYING: "border-[var(--day-violet)]/40 bg-[var(--day-violet)]/10 text-[#d9c6ff]",
  NOT_QUALIFIED: "border-white/10 bg-white/[0.03] text-white/50",
  QUALIFIED: "border-[var(--day-mint)]/40 bg-[var(--day-mint)]/10 text-[var(--day-mint)]",
  ALIVE: "border-[var(--day-mint)]/40 bg-[var(--day-mint)]/10 text-[var(--day-mint)]",
  ELIMINATED: "border-white/10 bg-white/[0.03] text-white/55",
  RUNNER_UP: "border-[#d8dde6]/40 bg-[#d8dde6]/10 text-[#e8ecf2]",
  CHAMPION: "border-[var(--day-gold)]/60 bg-[var(--day-gold)]/15 text-[var(--day-gold)]",
};

export function JourneyBadge({ journey, size = "sm" }: { journey: Journey; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${JOURNEY_TONES[journey.state]} ${
        size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      {journey.state === "CHAMPION" ? "🏆" : null}
      {journey.state === "ALIVE" ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {journey.label}
    </span>
  );
}

export function StatTile({ label, value, hint, tone = "white" }: { label: string; value: ReactNode; hint?: string; tone?: "white" | "gold" | "mint" | "rose" }) {
  const colour = {
    white: "text-white",
    gold: "text-[var(--day-gold)]",
    mint: "text-[var(--day-mint)]",
    rose: "text-[var(--day-rose)]",
  }[tone];
  return (
    <div className="day-glass p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--day-faint)]">{label}</p>
      <p className={`mt-2 font-display text-3xl font-extrabold tabular-nums sm:text-4xl ${colour}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--day-muted)]">{hint}</p> : null}
    </div>
  );
}

/**
 * Two teams, face to face. Used for "on the maze now", latest results and a
 * team's path through the bracket.
 */
export function MatchCard({
  match,
  nameOf,
  live = false,
  highlight,
}: {
  match: ResolvedMatch;
  nameOf: (id: string | null) => string | null;
  live?: boolean;
  highlight?: string;
}) {
  const sides = [
    { id: match.teamAId, seed: match.seedA, score: match.scoreA },
    { id: match.teamBId, seed: match.seedB, score: match.scoreB },
  ];
  return (
    <div
      className={`day-glass overflow-hidden p-4 ${live ? "border-[var(--day-rose)]/50 shadow-[0_0_60px_-20px_rgba(255,79,134,0.6)]" : ""}`}
    >
      <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--day-faint)]">
        <span className="flex items-center gap-2">
          {live ? <span className="day-live-dot" aria-hidden="true" /> : null}
          {live ? "On the maze now" : phaseInfo(match.round).name}
        </span>
        <span>{match.walkover ? "Bye" : match.winnerId ? "Final score" : `Match ${match.slot + 1}`}</span>
      </p>
      <div className="mt-3 space-y-2">
        {sides.map((side, index) => {
          const name = nameOf(side.id);
          const won = !!match.winnerId && match.winnerId === side.id;
          const lost = !!match.winnerId && !!side.id && match.winnerId !== side.id;
          return (
            <div
              key={index}
              className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${won ? "bg-[var(--day-gold)]/10" : ""} ${
                highlight && side.id === highlight ? "ring-1 ring-white/25" : ""
              }`}
            >
              <span className="w-6 shrink-0 text-right font-mono text-xs text-[var(--day-faint)]">{side.seed ?? ""}</span>
              {name ? <Crest name={name} size={22} /> : <span className="h-[29px] w-[29px] shrink-0 rounded-xl border border-dashed border-white/15" />}
              {side.id && name ? (
                <Link
                  href={`/day/teams/${side.id}`}
                  className={`min-w-0 flex-1 truncate font-semibold hover:underline ${lost ? "text-white/45" : "text-white"}`}
                >
                  {name}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate italic text-white/35">{match.round === 2 ? "Bye" : "To be decided"}</span>
              )}
              <span
                className={`font-display text-2xl font-extrabold tabular-nums ${
                  won ? "text-[var(--day-gold)]" : lost ? "text-white/40" : "text-white"
                }`}
              >
                {match.walkover ? "" : formatScore(side.score)}
              </span>
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
    <div className="space-y-5">
      {blocks.map((block, index) =>
        block.kind === "heading" ? (
          <h2 key={index} className="pt-4 font-display text-2xl font-extrabold tracking-tight text-white first:pt-0">
            {block.text}
          </h2>
        ) : block.kind === "list" ? (
          <ul key={index} className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[var(--day-muted)]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--day-gold)]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="max-w-3xl leading-relaxed text-[var(--day-muted)]">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
