import type { Metadata } from "next";
import Link from "next/link";
import { CenteredScroll } from "@/components/day-site/CenteredScroll";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { Empty, HeldBack, MatchCard, MoreLink, PageHead, SectionTitle } from "@/components/day-site/ui";
import { advanceShown } from "@/lib/reveal";
import { KNOCKOUT_ROUNDS, phaseInfo } from "@/lib/bracket";
import { type BracketMatch } from "@/lib/competition";
import { loadPublicCompetition } from "@/lib/public-competition";
import { formatPoints } from "@/lib/score-sheet";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;
export const metadata: Metadata = { title: "Bracket" };

type NameOf = (id: string | null) => string | null;

/** One match, small: the unit the tree is built from. */
function Cell({ match, nameOf }: { match: BracketMatch | undefined; nameOf: NameOf }) {
  if (!match || match.void) {
    return <div className="h-[4.5rem] rounded-[3px] border border-dashed border-day-line/[0.14]" aria-hidden="true" />;
  }
  const live = match.status === "LIVE";
  return (
    <div
      className={`overflow-hidden rounded-[3px] border text-[13px] ${
        live ? "day-floor border-day-live" : match.winnerId ? "border-day-line/25 bg-day-surface" : "border-day-line/[0.14] bg-day-surface"
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
            data-team={side.id ?? undefined}
            className={`flex h-9 items-center gap-1.5 px-2.5 ${index === 0 ? "border-b border-day-line/[0.1]" : ""} ${won ? "bg-day-gold/[0.12]" : ""}`}
          >
            <span className="day-num w-4 shrink-0 text-right text-[11px] font-semibold text-day-faint">{side.seed ?? ""}</span>
            {side.id && name ? (
              <Link
                href={`/day/teams/${side.id}`}
                className={`min-w-0 flex-1 truncate hover:underline ${won ? "font-bold text-day-ink" : lost ? "font-medium text-day-faint" : "font-semibold text-day-ink"}`}
                title={name}
              >
                {name}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate italic text-day-faint">{match.round === 2 ? "Bye" : "TBD"}</span>
            )}
            {live && index === 0 ? <span className="day-live-dot" aria-label="Live" /> : null}
            <span className={`day-num text-[14px] ${won ? "font-bold text-day-ink" : "text-day-muted"}`}>
              {match.walkover || side.score === null ? "" : formatPoints(side.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const done = (match: BracketMatch | undefined) => !match || match.void || !!match.winnerId;

/** A column of one round on one side, drawn as pairs so the lines join them. */
function Column({ matches, side, nameOf }: { matches: (BracketMatch | undefined)[]; side: "left" | "right"; nameOf: NameOf }) {
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
  await requireDayViewer();
  const state = await loadPublicCompetition();
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
    // A quiet floor: the maze behind would cross the bracket's own lines.
    <div className="space-y-12" data-quiet-floor>
      <PageHead
        kicker={liveCount ? `${liveCount} match${liveCount === 1 ? "" : "es"} on the maze now` : "Phases 2 to 6"}
        title="The bracket"
        lead="The top 32 from qualifying, seeded 1 against 32, 2 against 31 and so on. Two mice run side by side on identical mazes, and the higher score goes through."
      />

      <HeldBack reveal={state.reveal} phases={[2, 3, 4, 5, 6]} />

      {!state.drawn && state.reveal && !advanceShown(state.reveal, 1) && state.qualifyingStatus === "LOCKED" ? (
        <Empty icon="lock" title="The draw is announced soon">
          Qualifying is over and the judges have the bracket. It appears here the moment it is revealed.
        </Empty>
      ) : !state.drawn ? (
        <Empty icon="bracket" title="The draw has not happened yet">
          The bracket is drawn from the qualifying table once qualifying closes.
          <span className="mt-4 block">
            <MoreLink href="/day/standings">See who is in the top 32 right now</MoreLink>
          </span>
        </Empty>
      ) : (
        <>
          {/* The tree, from large screens up. */}
          <CenteredScroll className="day-bleed day-scroll-x hidden overflow-x-auto pb-4 lg:block">
            <div className="mx-auto min-w-[1640px] max-w-[1720px]" data-lenis-prevent-wheel>
              <div className="day-bracket mb-5 border-b-2 border-day-line/85 pb-3 text-center text-[0.8125rem] font-semibold text-day-muted" style={{ minHeight: 0 }}>
                {["Round of 32", "Round of 16", "Quarters", "Semis", "Final", "Semis", "Quarters", "Round of 16", "Round of 32"].map((label, index) => (
                  <span key={index} className={label === "Final" ? "font-bold text-day-crimson" : ""}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="day-bracket">
                <Column matches={half(2, "left")} side="left" nameOf={nameOf} />
                <Column matches={half(3, "left")} side="left" nameOf={nameOf} />
                <Column matches={half(4, "left")} side="left" nameOf={nameOf} />
                <Column matches={half(5, "left")} side="left" nameOf={nameOf} />

                <div className="flex flex-col items-center justify-center gap-6">
                  <DayIcon name="trophy" className="h-10 w-10 text-day-gold" />
                  <div className="w-full">
                    <Cell match={final} nameOf={nameOf} />
                  </div>
                  {champion ? (
                    <Link href={`/day/teams/${champion.id}`} className="flex flex-col items-center gap-3 text-center">
                      <Crest name={champion.name} size={56} ring />
                      <span className="text-sm font-bold text-day-gold">Champions</span>
                      <span className="day-display text-2xl leading-tight text-day-ink">{champion.name}</span>
                    </Link>
                  ) : (
                    <p className="text-center text-xs text-day-faint">The winner lifts the MMRC 26 trophy</p>
                  )}
                </div>

                <Column matches={half(5, "right")} side="right" nameOf={nameOf} />
                <Column matches={half(4, "right")} side="right" nameOf={nameOf} />
                <Column matches={half(3, "right")} side="right" nameOf={nameOf} />
                <Column matches={half(2, "right")} side="right" nameOf={nameOf} />
              </div>
            </div>
          </CenteredScroll>

          {/* Round by round, below that. */}
          <div className="space-y-12 lg:hidden">
            {champion ? (
              <Link href={`/day/teams/${champion.id}`} className="day-floor day-posts flex items-center gap-4 p-5">
                <Crest name={champion.name} size={52} ring />
                <span>
                  <span className="block text-sm font-bold text-day-gold">Champions</span>
                  <span className="day-display mt-1 block text-2xl text-day-ink">{champion.name}</span>
                </span>
              </Link>
            ) : null}
            {/* In playing order. A round nobody has reached yet is one line,
                not a column of empty boxes to scroll past. */}
            {KNOCKOUT_ROUNDS.map((round) => {
              const matches = state.bracket.filter((m) => m.round === round && !m.void);
              const reached = matches.some((m) => m.teamAId || m.teamBId);
              return (
                <section key={round} aria-labelledby={`r-${round}`} className="space-y-4">
                  <SectionTitle id={`r-${round}`} kicker={`Phase ${round}`}>
                    {phaseInfo(round).name}
                  </SectionTitle>
                  {reached ? (
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                      {matches.map((match) => (
                        <MatchCard key={match.id} match={match} nameOf={nameOf} live={match.status === "LIVE"} arena={match.arena} showSheets />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-day-muted">
                      {matches.length} match{matches.length === 1 ? "" : "es"}, once the {phaseInfo(round - 1).name} is played.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
