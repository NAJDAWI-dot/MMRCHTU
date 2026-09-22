import type { Metadata } from "next";
import { TeamGrid } from "@/components/day-site/TeamGrid";
import { PageHead } from "@/components/day-site/ui";
import { formatScore } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";

export const revalidate = 30;
export const metadata: Metadata = { title: "Teams" };

export default async function DayTeamsPage() {
  const state = await loadCompetition();
  const stillIn = state.competitors.filter(
    (team) => !["NOT_QUALIFIED", "ELIMINATED", "RUNNER_UP"].includes(team.journey.state),
  ).length;

  return (
    <div className="space-y-10">
      <PageHead
        kicker={`${state.competitors.length} teams · ${stillIn} still in it`}
        title="The teams"
        lead="Tap any team for its members, its qualifying score, its seed, and how far it has got."
      />
      <TeamGrid
        teams={state.competitors.map((team) => ({
          id: team.id,
          name: team.name,
          journey: team.journey,
          rank: team.standing?.rank ?? null,
          best: formatScore(team.standing?.best),
          seed: team.journey.seed,
          checkedIn: team.checkedIn,
          robotName: team.robotName,
        }))}
      />
      {state.competitors.length === 0 ? (
        <p className="day-glass p-6 text-[var(--day-muted)]">Teams appear here once their registrations are confirmed.</p>
      ) : null}
    </div>
  );
}
