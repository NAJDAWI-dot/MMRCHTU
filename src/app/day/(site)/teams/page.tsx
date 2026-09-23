import type { Metadata } from "next";
import { TeamGrid } from "@/components/day-site/TeamGrid";
import { Empty, PageHead } from "@/components/day-site/ui";
import { loadCompetition } from "@/lib/competition";
import { prisma } from "@/lib/prisma";
import { formatPoints, formatTime } from "@/lib/score-sheet";

export const revalidate = 30;
export const metadata: Metadata = { title: "Teams" };

/** The most common university in a team, which is what a card has room for. */
function universityOf(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names.map((n) => n.trim()).filter(Boolean)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export default async function DayTeamsPage() {
  const state = await loadCompetition();
  const members = await prisma.teamMember.findMany({
    where: { registrationId: { in: state.competitors.map((team) => team.id) } },
    select: { registrationId: true, university: true },
  });
  const byTeam = new Map<string, string[]>();
  for (const member of members) byTeam.set(member.registrationId, [...(byTeam.get(member.registrationId) ?? []), member.university]);

  const stillIn = state.competitors.filter((team) => !["NOT_QUALIFIED", "ELIMINATED", "RUNNER_UP"].includes(team.journey.state)).length;

  return (
    <div className="space-y-12">
      <PageHead
        kicker={`${state.competitors.length} teams · ${stillIn} still in it`}
        title="The teams"
        lead="Tap a team to see its members, every run it made, its score and whether it has qualified."
      />
      {state.competitors.length ? (
        <TeamGrid
          teams={state.competitors.map((team) => ({
            id: team.id,
            name: team.name,
            journey: team.journey,
            rank: team.standing?.rank ?? null,
            score: formatPoints(team.standing?.best),
            runs: team.standing?.runs ?? 0,
            best: team.standing?.official ? formatTime(team.standing.official) : "–",
            seed: team.journey.seed,
            checkedIn: team.checkedIn,
            robotName: team.robotName,
            members: byTeam.get(team.id)?.length ?? team.memberCount,
            university: universityOf(byTeam.get(team.id) ?? []),
          }))}
        />
      ) : (
        <Empty icon="teams" title="No teams yet">
          Teams appear here once their registrations are confirmed.
        </Empty>
      )}
    </div>
  );
}
