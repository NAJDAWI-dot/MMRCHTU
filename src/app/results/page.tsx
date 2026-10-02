import type { Metadata } from "next";
import { awardsList, picksOf, type Award } from "@/lib/awards";
import { PLAYED_ROUNDS, phaseInfo } from "@/lib/bracket";
import { loadPublicCompetition } from "@/lib/public-competition";
import { formatPoints, formatTime } from "@/lib/score-sheet";
import { getCompetitionDayConfig } from "@/lib/site-config";

// The results change only when the desks reveal something, and every reveal
// clears the site; the timer is a backstop.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Results",
  description: "MMRC 26 results: the winners, the awards, the knockout and the qualifying table.",
};

const PLACE_STYLE: Record<1 | 2 | 3, string> = {
  1: "border-ras-crimson/40 bg-[var(--color-surface)] bg-gradient-to-br from-ras-crimson/10 via-transparent to-ras-purple/10 sm:order-2 sm:-mt-6",
  2: "border-ras-gray/25 bg-[var(--color-surface)] sm:order-1",
  3: "border-ras-gray/25 bg-[var(--color-surface)] sm:order-3",
};

/**
 * The results, for good: the podium, every award, the knockout round by round
 * and the qualifying table. Stays on the main site after the day site is
 * switched off. Reads the public competition, so whatever the desks are still
 * holding back is held back here too.
 */
export default async function ResultsPage() {
  const [state, config] = await Promise.all([loadPublicCompetition(), getCompetitionDayConfig()]);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const awards = awardsList(state.bracket, picksOf(config, (id) => state.byId.has(id)), config.awardsShown);
  const podium = awards.filter((award): award is Award & { place: 1 | 2 | 3 } => award.kind === "place" && !!award.place);
  const others = awards.filter((award) => award.kind !== "place");
  const anyAward = awards.some((award) => award.teamId);
  const ranked = state.table.filter((row) => row.rank !== null);
  const rounds = PLAYED_ROUNDS.filter((round) => state.bracket.some((match) => match.round === round && match.teamAId && match.teamBId && !match.walkover));

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">MMRC 26</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold text-ras-purple dark:text-white sm:text-5xl">Results</h1>
      <p className="mt-3 max-w-2xl text-ras-gray dark:text-white/70">
        {[config.dateText, config.venue].filter(Boolean).join(" · ") || "The Micromouse Robotics Competition."}
      </p>

      {!anyAward && !ranked.length ? (
        <p className="mt-10 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-6 text-ras-gray dark:text-white/70">
          The results are announced at the prize-giving on competition day, and appear here straight after.
        </p>
      ) : null}

      {anyAward ? (
        <>
          <section className="mt-12" aria-labelledby="podium">
            <h2 id="podium" className="font-display text-xl font-bold text-ras-purple dark:text-white">
              The podium
            </h2>
            <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              {podium.map((award) => (
                <li key={award.key} className={`rounded-xl border p-5 text-center ${PLACE_STYLE[award.place]}`}>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{award.title}</p>
                  <p className={`mt-3 font-display font-extrabold text-ras-purple dark:text-white ${award.place === 1 ? "text-3xl" : "text-2xl"}`}>
                    {award.teamId ? nameOf(award.teamId) : <span className="text-base font-semibold italic text-ras-gray">To be decided</span>}
                  </p>
                  <p className="mt-2 text-sm text-ras-gray dark:text-white/60">{award.blurb}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12" aria-labelledby="awards">
            <h2 id="awards" className="font-display text-xl font-bold text-ras-purple dark:text-white">
              The awards
            </h2>
            <ul className="mt-4 divide-y divide-ras-gray/15 overflow-hidden rounded-lg border border-ras-gray/15 bg-[var(--color-surface)]">
              {others.map((award) => (
                <li key={award.key} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 p-4">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ras-purple dark:text-white">{award.title}</span>
                    <span className="block text-sm text-ras-gray dark:text-white/60">{award.detail || award.blurb}</span>
                  </span>
                  <span className={`font-display text-lg font-bold ${award.teamId ? "text-ras-purple dark:text-white" : "text-sm font-semibold italic text-ras-gray"}`}>
                    {award.teamId ? nameOf(award.teamId) : config.awardsShown ? "Not awarded" : "Announced at the prize-giving"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {rounds.length ? (
        <section className="mt-12" aria-labelledby="knockout">
          <h2 id="knockout" className="font-display text-xl font-bold text-ras-purple dark:text-white">
            The knockout
          </h2>
          <div className="mt-4 space-y-8">
            {[...rounds].reverse().map((round) => (
              <div key={round}>
                <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{phaseInfo(round).name}</h3>
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {state.bracket
                    .filter((match) => match.round === round && match.teamAId && match.teamBId && !match.walkover)
                    .map((match) => (
                      <li key={match.id} className="rounded-lg border border-ras-gray/15 bg-[var(--color-surface)] p-3">
                        {[
                          { id: match.teamAId, score: match.scoreA },
                          { id: match.teamBId, score: match.scoreB },
                        ].map((side) => {
                          const won = !!match.winnerId && match.winnerId === side.id;
                          return (
                            <p key={side.id} className="flex items-center justify-between gap-3 py-0.5">
                              <span className={`truncate ${won ? "font-bold text-ras-purple dark:text-white" : "text-ras-gray dark:text-white/70"}`}>
                                {nameOf(side.id)}
                                {won ? <span className="sr-only"> (winner)</span> : null}
                              </span>
                              <span className={`font-mono text-sm ${won ? "font-bold text-accent" : "text-ras-gray dark:text-white/60"}`}>
                                {side.score !== null ? formatPoints(side.score) : ""}
                              </span>
                            </p>
                          );
                        })}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {ranked.length ? (
        <section className="mt-12" aria-labelledby="qualifying">
          <h2 id="qualifying" className="font-display text-xl font-bold text-ras-purple dark:text-white">
            Qualifying
          </h2>
          <p className="mt-1 text-sm text-ras-gray dark:text-white/60">
            Score = (successful runs + 1.5 × successful returns) ÷ official time × 1000. The top {state.bracketSize} went through to the knockout.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-ras-gray/15 bg-[var(--color-surface)]">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-ras-gray/15 text-xs uppercase tracking-wide text-ras-gray dark:text-white/60">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Place
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Team
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Runs
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Returns
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Official time
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ras-gray/10">
                {ranked.map((row) => (
                  <tr key={row.teamId} className={row.qualified ? "" : "text-ras-gray dark:text-white/60"}>
                    <td className="px-4 py-2.5 font-mono">{row.rank}</td>
                    <td className="px-4 py-2.5 font-semibold text-ras-purple dark:text-white">{row.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{row.runs}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{row.returns}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatTime(row.official)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">{formatPoints(row.best)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
