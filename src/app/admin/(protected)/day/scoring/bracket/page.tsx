import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { loadCompetition } from "@/lib/competition";
import { prisma } from "@/lib/prisma";
import { KNOCKOUT_ROUNDS, phaseInfo } from "@/lib/bracket";
import { DeskTabs } from "../../DeskTabs";
import { MatchForm, type MatchRow } from "./MatchForm";

export const metadata: Metadata = { title: "Admin | Bracket" };

/** Phases two to six: every match, round by round, with its result form. */
export default async function BracketDeskPage() {
  const admin = await requireSection("/admin/day/scoring");
  const [state, stored] = await Promise.all([
    loadCompetition(),
    prisma.knockoutMatch.findMany({ select: { id: true, round: true, slot: true, status: true, arena: true } }),
  ]);

  const nameOf = (id: string | null, fallback: string) => (id ? (state.byId.get(id)?.name ?? "Unknown team") : fallback);
  const rows: MatchRow[] = state.bracket.map((match) => {
    const row = stored.find((s) => s.round === match.round && s.slot === match.slot);
    return {
      id: row?.id ?? match.id,
      label: `${phaseInfo(match.round).short} · Match ${match.slot + 1}`,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      teamA: nameOf(match.teamAId, match.round === 2 ? "Bye" : "Winner to come"),
      teamB: nameOf(match.teamBId, match.round === 2 ? "Bye" : "Winner to come"),
      seedA: match.seedA,
      seedB: match.seedB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      winnerId: match.winnerId,
      status: row?.status ?? "PENDING",
      arena: row?.arena ?? "",
      walkover: match.walkover,
      void: match.void,
      tied: match.tied,
    };
  });

  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");

  return (
    <div>
      <AdminPageHeader
        title="Bracket"
        subtitle={
          state.drawn
            ? champion
              ? `Finished. ${champion.name} are the champions.`
              : "Enter each result as it comes in. Winners move on by themselves."
            : "Not drawn yet."
        }
      />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day/scoring/bracket" />

      {!state.drawn ? (
        <Card className="mt-6">
          <p className="text-sm text-ras-gray dark:text-white/70">
            The bracket is drawn from the qualifying table.{" "}
            <Link href="/admin/day/scoring" className="font-semibold text-accent hover:underline">
              Lock qualifying and draw it →
            </Link>
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-8">
          {KNOCKOUT_ROUNDS.map((round) => {
            const info = phaseInfo(round);
            const matches = rows.filter((row) => row.label.startsWith(info.short) && !row.void);
            const decided = matches.filter((row) => row.winnerId).length;
            return (
              <section key={round} aria-labelledby={`round-${round}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`round-${round}`} className="font-display text-xl font-bold text-ras-purple dark:text-white">
                    Phase {round} · {info.name}
                  </h2>
                  <p className="font-mono text-xs text-ras-gray dark:text-white/55">
                    {decided} of {matches.length} decided
                  </p>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {matches.map((row) => (
                    // Keyed by the pairing and the result as well as the id,
                    // so a form redraws with fresh values whenever an earlier
                    // result changes who is in it; the green "done" state is
                    // the confirmation then, rather than the notice.
                    <MatchForm
                      key={`${row.id}:${row.teamAId}:${row.teamBId}:${row.scoreA}:${row.scoreB}:${row.winnerId}:${row.status}`}
                      match={row}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
