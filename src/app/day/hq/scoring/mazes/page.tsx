import type { Metadata } from "next";
import Link from "next/link";
import { requireSection } from "@/lib/admin-access";
import { PLAYED_ROUNDS, phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { parseMazeNames } from "@/lib/mazes";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { DeskForm, DeskHead, Submit } from "../../DeskKit";
import { saveMazeNames } from "./actions";
import { MatchMazes, QualifyingMazes } from "./MazeForms";

export const metadata: Metadata = { title: "Mazes" };

/**
 * Which maze every team runs on, stage by stage: qualifying, then each side
 * of each knockout match. Shown wherever the team is called: its page, the
 * "get ready" message, the hall screen and the judge's tablet.
 */
export default async function MazesDeskPage({ searchParams }: { searchParams?: { stage?: string } }) {
  await requireSection("/day/hq/scoring/mazes");
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  const mazes = parseMazeNames(config.mazeNames);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");

  const rounds = PLAYED_ROUNDS.filter((round) => state.bracket.some((match) => match.round === round && !match.void));
  const stages = [{ key: "q", label: "Qualifying" }, ...rounds.map((round) => ({ key: String(round), label: phaseInfo(round).name }))];
  const stage = stages.some((item) => item.key === searchParams?.stage) ? searchParams!.stage! : "q";

  const teams = state.competitors
    .filter((team) => team.eligible)
    .sort((a, b) => (a.runOrder ?? 9999) - (b.runOrder ?? 9999) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
    .map((team) => ({ id: team.id, name: team.name, code: team.teamCode, runOrder: team.runOrder, maze: team.qualifyingMaze }));
  const matches = state.bracket
    .filter((match) => String(match.round) === stage && !match.void && !match.walkover)
    .map((match) => ({
      id: match.id,
      label: `${phaseInfo(match.round).name}${match.round === 7 ? "" : ` · Match ${match.slot + 1}`}`,
      teamA: nameOf(match.teamAId),
      teamB: nameOf(match.teamBId),
      mazeA: match.mazeA,
      mazeB: match.mazeB,
    }));

  return (
    <div className="space-y-8">
      <DeskHead
        icon="compass"
        title="Mazes"
        lead="Put every team on a maze, stage by stage. The team's page, its get ready message, the hall screen and the judge's tablet all say where to go."
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
          <p className="text-xs text-day-muted">Separate them with commas. These are the choices below.</p>
        </DeskForm>
      </section>

      <div className="day-no-scrollbar -mx-1 overflow-x-auto px-1">
        <nav aria-label="Stages" className="day-segment flex-nowrap">
          {stages.map((item) => (
            <Link key={item.key} href={`/day/hq/scoring/mazes?stage=${item.key}`} aria-current={item.key === stage ? "page" : undefined}>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {stage === "q" ? (
        teams.length ? (
          <QualifyingMazes key={`q:${teams.map((team) => team.maze).join(",")}`} teams={teams} mazes={mazes} />
        ) : (
          <p className="day-card p-6 text-day-muted">No confirmed teams yet.</p>
        )
      ) : matches.length ? (
        <MatchMazes key={`${stage}:${matches.map((match) => `${match.mazeA}/${match.mazeB}`).join(",")}`} matches={matches} mazes={mazes} />
      ) : (
        <p className="day-card p-6 text-day-muted">No matches to play in this round.</p>
      )}
      {!state.drawn ? <p className="text-sm text-day-muted">The knockout rounds appear here once the bracket is drawn.</p> : null}
    </div>
  );
}
