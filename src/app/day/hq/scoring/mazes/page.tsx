import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/admin-access";
import { phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { ALONE_ROUNDS, PLAY_ORDER } from "@/lib/knockout-schedule";
import { parseMazeNames } from "@/lib/mazes";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { DeskForm, DeskHead, Submit } from "../../DeskKit";
import { autoSchedule, saveMazeNames } from "./actions";
import { MatchSchedule, QualifyingMazes, type ScheduleRow } from "./MazeForms";

export const metadata: Metadata = { title: "Mazes and times" };

/**
 * Which maze every team runs on, and when: qualifying, where the mazes run
 * side by side and the draw shares the order round them, then the knockout,
 * one maze a match, two matches at a time, the play-off and the final alone.
 * Shown wherever the team is called: its page, the "get ready" message, the
 * hall screen and the judge's tablet.
 */
export default async function MazesDeskPage({ searchParams }: { searchParams?: { stage?: string } }) {
  await requireSection("/day/hq/scoring/mazes");
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  const mazes = parseMazeNames(config.mazeNames);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const stage = searchParams?.stage === "ko" && state.drawn ? "ko" : "q";

  const teams = state.competitors
    .filter((team) => team.eligible)
    .sort((a, b) => (a.runOrder ?? 9999) - (b.runOrder ?? 9999) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
    .map((team) => ({ id: team.id, name: team.name, code: team.teamCode, runOrder: team.runOrder, maze: team.qualifyingMaze }));

  const playable = state.bracket.filter((match) => !match.void && !match.walkover);
  const rounds = PLAY_ORDER.filter((round) => playable.some((match) => match.round === round));
  const rows: ScheduleRow[] = rounds.flatMap((round) =>
    playable
      .filter((match) => match.round === round)
      .sort((a, b) => a.slot - b.slot)
      .map((match) => ({
        id: match.id,
        round: phaseInfo(round).name,
        label: ALONE_ROUNDS.includes(round) ? "" : `Match ${match.slot + 1}`,
        teamA: nameOf(match.teamAId),
        teamB: nameOf(match.teamBId),
        time: match.scheduledAt ? clockTime(match.scheduledAt) : "",
        maze: match.arena || match.mazeA || match.mazeB,
        played: !!match.winnerId,
      })),
  );
  const firstToPlay = rounds.find((round) => playable.some((match) => match.round === round && !match.winnerId)) ?? rounds[0];
  const sideBySide = mazes.length > 1;

  return (
    <div className="space-y-8">
      <DeskHead
        icon="compass"
        title="Mazes and times"
        lead="Where every team runs, and when. The team's page, its get ready message, the hall screen and the judge's tablet all follow it."
      />

      <section className="day-card p-5 sm:p-6">
        <DeskForm action={saveMazeNames} className="space-y-3">
          <label className="day-label" htmlFor="maze-names">
            The mazes on the floor
          </label>
          <div className="flex flex-wrap items-start gap-3">
            <input id="maze-names" name="names" defaultValue={mazes.join(", ")} placeholder="Maze A, Maze B" className="day-input min-w-0 flex-1" />
            <Submit pending="Saving…" variant="secondary">
              Save names
            </Submit>
          </div>
          <p className="text-xs text-day-muted">
            Separate them with commas. They run side by side:{" "}
            {sideBySide ? `${mazes.length} qualifying runs at once, and ${mazes.length} knockout matches at once until the play-off and the final` : "one run and one match at a time"}.
          </p>
        </DeskForm>
      </section>

      <nav aria-label="Stages" className="day-segment">
        <Link href="/day/hq/scoring/mazes?stage=q" aria-current={stage === "q" ? "page" : undefined}>
          <span>Qualifying</span>
        </Link>
        {state.drawn ? (
          <Link href="/day/hq/scoring/mazes?stage=ko" aria-current={stage === "ko" ? "page" : undefined}>
            <span>Knockout</span>
          </Link>
        ) : null}
      </nav>

      {stage === "q" ? (
        <>
          {sideBySide ? (
            <p className="text-sm text-day-muted">
              The draw shares the running order round the mazes ({mazes.map((maze, index) => `#${index + 1} on ${maze}`).join(", ")}, and round again), and each call
              puts one team on every maze. Change any team&apos;s maze here.
            </p>
          ) : null}
          {teams.length ? (
            <QualifyingMazes key={`q:${teams.map((team) => team.maze).join(",")}`} teams={teams} mazes={mazes} />
          ) : (
            <p className="day-card p-6 text-day-muted">No confirmed teams yet.</p>
          )}
          {!state.drawn ? <p className="text-sm text-day-muted">The knockout appears here once the bracket is drawn.</p> : null}
        </>
      ) : (
        <>
          <section className="day-card space-y-4 p-5 sm:p-6" aria-labelledby="auto-title">
            <div>
              <h2 id="auto-title" className="day-display text-2xl text-day-ink">
                Time it for me
              </h2>
              <p className="mt-1 text-sm text-day-muted">
                {sideBySide
                  ? `Two matches at a time, one on ${mazes[0]} and one on ${mazes[1]}${mazes.length > 2 ? " and so on" : ""}. The third place play-off and then the final are played on their own, on ${mazes[0]}.`
                  : "One match at a time, the third place play-off before the final."}{" "}
                Matches already played keep their times. Change any time or maze below afterwards.
              </p>
            </div>
            <DeskForm action={autoSchedule} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
              <div>
                <label className="day-label" htmlFor="ko-start">
                  First match
                </label>
                <input id="ko-start" name="start" type="time" required className="day-input day-num" />
              </div>
              <div>
                <label className="day-label" htmlFor="ko-minutes">
                  Minutes a match
                </label>
                <input id="ko-minutes" name="minutes" type="number" min={1} max={120} defaultValue={15} required className="day-input day-num" />
              </div>
              <div>
                <label className="day-label" htmlFor="ko-break">
                  Break between rounds
                </label>
                <input id="ko-break" name="break" type="number" min={0} max={180} defaultValue={10} className="day-input day-num" />
              </div>
              <div>
                <label className="day-label" htmlFor="ko-from">
                  From
                </label>
                <select id="ko-from" name="fromRound" defaultValue={firstToPlay} className="day-input">
                  {rounds.map((round) => (
                    <option key={round} value={round}>
                      {phaseInfo(round).name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Submit pending="Timing…">Time the matches</Submit>
              </div>
            </DeskForm>
          </section>

          {rows.length ? (
            <MatchSchedule rows={rows} mazes={mazes} />
          ) : (
            <p className="day-card p-6 text-day-muted">No matches to play.</p>
          )}
        </>
      )}
    </div>
  );
}
