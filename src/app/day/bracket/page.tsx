import type { Metadata } from "next";
import Link from "next/link";
import { Crest } from "@/components/day-site/Crest";
import { PageHead } from "@/components/day-site/ui";
import { KNOCKOUT_ROUNDS, formatScore, phaseInfo } from "@/lib/bracket";
import { loadCompetition, type BracketMatch } from "@/lib/competition";

export const revalidate = 30;
export const metadata: Metadata = { title: "Bracket" };

type NameOf = (id: string | null) => string | null;

/** One match, small: the unit the tree is built from. */
function Cell({ match, nameOf }: { match: BracketMatch | undefined; nameOf: NameOf }) {
  if (!match || match.void) {
    return <div className="h-[4.25rem] rounded-xl border border-dashed border-white/[0.06]" aria-hidden="true" />;
  }
  const live = match.status === "LIVE";
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white/[0.045] text-[13px] backdrop-blur ${
        live
          ? "border-[var(--day-rose)]/60 shadow-[0_0_30px_-8px_rgba(255,79,134,0.7)]"
          : match.winnerId
            ? "border-[var(--day-gold)]/30"
            : "border-white/10"
      }`}
    >
      {[
        { id: match.teamAId, seed: match.seedA, score: match.scoreA },
        { id: match.teamBId, seed: match.seedB, score: match.scoreB },
      ].map((side, index) => {
        const name = nameOf(side.id);
        const won = !!match.winnerId && match.winnerId === side.id;
        const lost = !!match.winnerId && !!side.id && !won;
        return (
          <div
            key={index}
            className={`flex h-[2.1rem] items-center gap-2 px-2.5 ${index === 0 ? "border-b border-white/[0.06]" : ""} ${
              won ? "bg-[var(--day-gold)]/[0.12]" : ""
            }`}
          >
            <span className="w-4 shrink-0 text-right font-mono text-[10px] text-[var(--day-faint)]">{side.seed ?? ""}</span>
            {side.id && name ? (
              <Link
                href={`/day/teams/${side.id}`}
                className={`min-w-0 flex-1 truncate font-semibold hover:underline ${
                  won ? "text-[var(--day-gold)]" : lost ? "text-white/40 line-through decoration-white/20" : "text-white"
                }`}
                title={name}
              >
                {name}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate italic text-white/30">
                {match.round === 2 ? "Bye" : live ? "" : "To be decided"}
              </span>
            )}
            <span className={`font-mono tabular-nums ${won ? "font-bold text-[var(--day-gold)]" : "text-white/70"}`}>
              {match.walkover ? "" : side.score === null ? "" : formatScore(side.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const done = (match: BracketMatch | undefined) => !match || match.void || !!match.winnerId;

/** A column of one round on one side, drawn as pairs so the lines join them. */
function Column({
  matches,
  side,
  nameOf,
}: {
  matches: (BracketMatch | undefined)[];
  side: "left" | "right";
  nameOf: NameOf;
}) {
  if (matches.length === 1) {
    return (
      <div className={`day-bracket-col day-bracket-${side}`}>
        <div className="day-bracket-single" data-decided={done(matches[0]) && !!matches[0]?.winnerId}>
          <Cell match={matches[0]} nameOf={nameOf} />
        </div>
      </div>
    );
  }
  const pairs: (BracketMatch | undefined)[][] = [];
  for (let i = 0; i < matches.length; i += 2) pairs.push([matches[i], matches[i + 1]]);
  return (
    <div className={`day-bracket-col day-bracket-${side}`}>
      {pairs.map((pair, index) => (
        <div key={index} className="day-bracket-pair" data-decided={done(pair[0]) && done(pair[1])}>
          {pair.map((match, i) => (
            <div key={i} className="day-bracket-slot">
              <Cell match={match} nameOf={nameOf} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Phases 2 to 6: two halves of the draw, meeting at the final. */
export default async function DayBracketPage() {
  const state = await loadCompetition();
  const nameOf: NameOf = (id) => (id ? (state.byId.get(id)?.name ?? null) : null);
  const at = (round: number, slot: number) => state.bracket.find((m) => m.round === round && m.slot === slot);
  const half = (round: number, side: "left" | "right") => {
    const count = 2 ** (6 - round);
    const start = side === "left" ? 0 : count / 2;
    return Array.from({ length: count / 2 }, (_, i) => at(round, start + i));
  };

  const final = at(6, 0);
  const champion = final?.winnerId ? state.byId.get(final.winnerId) : undefined;
  const liveCount = state.bracket.filter((m) => m.status === "LIVE").length;

  return (
    <div className="space-y-10">
      <PageHead
        kicker={liveCount ? `${liveCount} match${liveCount === 1 ? "" : "es"} on the maze now` : "Phases 2 to 6"}
        title="The bracket"
        lead="The top 32 from qualifying, seeded 1 against 32, 2 against 31 and so on. Win and you move one column closer to the middle."
      />

      {!state.drawn ? (
        <div className="day-glass p-8 text-center">
          <p className="font-display text-2xl font-extrabold text-white">The draw has not happened yet</p>
          <p className="mx-auto mt-2 max-w-lg text-[var(--day-muted)]">
            The bracket is drawn from the qualifying table once qualifying closes.{" "}
            <Link href="/day/standings" className="font-semibold text-[var(--day-gold)] hover:underline">
              See who is in the top 32 right now →
            </Link>
          </p>
        </div>
      ) : (
        <>
          {/* The tree, from large screens up. */}
          <div className="hidden overflow-x-auto pb-4 lg:block">
            <div className="min-w-[1180px]">
              <div className="day-bracket mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--day-faint)]" style={{ minHeight: 0 }}>
                {["R32", "R16", "QF", "SF", "Final", "SF", "QF", "R16", "R32"].map((label, index) => (
                  <span key={index} className={label === "Final" ? "text-[var(--day-gold)]" : ""}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="day-bracket">
                <Column matches={half(2, "left")} side="left" nameOf={nameOf} />
                <Column matches={half(3, "left")} side="left" nameOf={nameOf} />
                <Column matches={half(4, "left")} side="left" nameOf={nameOf} />
                <Column matches={half(5, "left")} side="left" nameOf={nameOf} />

                <div className="flex flex-col items-center justify-center gap-5">
                  <div
                    aria-hidden="true"
                    className="grid h-16 w-16 place-items-center rounded-2xl border border-[var(--day-gold)]/50 bg-[var(--day-gold)]/10 text-3xl shadow-[0_0_60px_-10px_rgba(242,169,0,0.7)]"
                  >
                    🏆
                  </div>
                  <div className="w-full">
                    <Cell match={final} nameOf={nameOf} />
                  </div>
                  {champion ? (
                    <Link href={`/day/teams/${champion.id}`} className="flex flex-col items-center gap-2 text-center">
                      <Crest name={champion.name} size={48} glow />
                      <span className="day-kicker">Champions</span>
                      <span className="day-gradient-text day-shimmer font-display text-2xl font-extrabold leading-tight">
                        {champion.name}
                      </span>
                    </Link>
                  ) : (
                    <p className="text-center text-xs text-[var(--day-faint)]">The winner lifts the MMRC 26 trophy</p>
                  )}
                </div>

                <Column matches={half(5, "right")} side="right" nameOf={nameOf} />
                <Column matches={half(4, "right")} side="right" nameOf={nameOf} />
                <Column matches={half(3, "right")} side="right" nameOf={nameOf} />
                <Column matches={half(2, "right")} side="right" nameOf={nameOf} />
              </div>
            </div>
          </div>

          {/* Round by round, below that. */}
          <div className="space-y-10 lg:hidden">
            {champion ? (
              <Link href={`/day/teams/${champion.id}`} className="day-glass flex items-center gap-4 border-[var(--day-gold)]/50 p-5">
                <Crest name={champion.name} size={52} glow />
                <span>
                  <span className="day-kicker block">Champions</span>
                  <span className="day-gradient-text day-shimmer font-display text-2xl font-extrabold">{champion.name}</span>
                </span>
              </Link>
            ) : null}
            {[...KNOCKOUT_ROUNDS].reverse().map((round) => {
              const matches = state.bracket.filter((m) => m.round === round && !m.void);
              return (
                <section key={round} aria-labelledby={`r-${round}`}>
                  <h2 id={`r-${round}`} className="font-display text-2xl font-extrabold text-white">
                    <span className="day-kicker mr-3">Phase {round}</span>
                    {phaseInfo(round).name}
                  </h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {matches.map((match) => (
                      <Cell key={match.id} match={match} nameOf={nameOf} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
