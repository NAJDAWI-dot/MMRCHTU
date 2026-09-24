import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCompetitionDayConfig } from "@/lib/site-config";
import {
  journeyOf,
  parseInspection,
  parseQualifyingStatus,
  resolveBracket,
  standings,
  type Direction,
  type InspectionState,
  type Journey,
  type QualifyingStatus,
  type ResolvedMatch,
  type Standing,
} from "@/lib/bracket";

/**
 * Everything about the competition itself, read once per request.
 *
 * Shared by the admin desks and the day site so both show the same table and
 * the same bracket: the bracket is always resolved from the first round and
 * the results, never read back as stored, so what the public sees can never
 * disagree with what the scoring desk sees.
 *
 * Competitors are confirmed registrations. Withdrawn teams and teams that
 * failed inspection stay on the lists but cannot qualify.
 */

export interface Competitor {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  checkedIn: boolean;
  checkedInAt: Date | null;
  inspection: InspectionState;
  inspectionNote: string;
  robotName: string;
  pit: string;
  withdrawn: boolean;
  /** TeamMember ids the desk has marked as here. */
  presentIds: string[];
  badges: boolean;
  deskNote: string;
  /** Place in the phase 1 running order, once drawn. */
  runOrder: number | null;
  /** A slot time set by hand or imported ("09:40"), or "" to work it out from the order. */
  slotTime: string;
  eligible: boolean;
  standing: Standing | undefined;
  journey: Journey;
}

/** A resolved match plus what only the stored row knows: live or not, when and where. */
export interface BracketMatch extends ResolvedMatch {
  status: string;
  arena: string;
  scheduledAt: Date | null;
  updatedAt: Date | null;
}

export interface CompetitionState {
  qualifyingStatus: QualifyingStatus;
  qualifyingDirection: Direction;
  qualifyingNote: string;
  matchDirection: Direction;
  competitors: Competitor[];
  table: Standing[];
  bracket: BracketMatch[];
  /** Whether the round of 32 has been drawn. */
  drawn: boolean;
  byId: Map<string, Competitor>;
}

export const loadCompetition = cache(async (): Promise<CompetitionState> => {
  const [config, teams, runs, matches] = await Promise.all([
    getCompetitionDayConfig(),
    prisma.registration.findMany({
      where: { status: "CONFIRMED" },
      select: { id: true, teamName: true, status: true, memberCount: true, dayStatus: true },
    }),
    prisma.qualifyingRun.findMany({
      select: { registrationId: true, score: true, runTimes: true, remaining: true, runLog: true, createdAt: true },
    }),
    prisma.knockoutMatch.findMany({ orderBy: [{ round: "asc" }, { slot: "asc" }] }),
  ]);

  // The rulebook formula: a higher score is always the better one. The stored
  // direction settings predate it and are no longer offered.
  const qualifyingDirection: Direction = "HIGHER";
  const matchDirection: Direction = "HIGHER";
  const ineligible = new Set(
    teams
      .filter((team) => team.dayStatus?.withdrawn || parseInspection(team.dayStatus?.inspection) === "FAILED")
      .map((team) => team.id),
  );

  const table = standings(
    teams.map((team) => ({ id: team.id, name: team.teamName.trim() })),
    runs,
    { ineligible },
  );
  const bracket = resolveBracket(matches, matchDirection).matches.map((match) => {
    const stored = matches.find((row) => row.round === match.round && row.slot === match.slot);
    return {
      ...match,
      id: stored?.id ?? match.id,
      // A decided match is never still live, whatever the row last said.
      status: match.winnerId ? "DONE" : (stored?.status ?? "PENDING"),
      arena: stored?.arena ?? "",
      scheduledAt: stored?.scheduledAt ?? null,
      updatedAt: stored?.updatedAt ?? null,
    };
  });
  const drawn = matches.length > 0;
  const qualifyingStatus = parseQualifyingStatus(config.qualifyingStatus);
  const standingById = new Map(table.map((row) => [row.teamId, row]));

  const competitors: Competitor[] = teams
    .map((team) => {
      const standing = standingById.get(team.id);
      return {
        id: team.id,
        name: team.teamName.trim(),
        status: team.status,
        memberCount: team.memberCount,
        checkedIn: !!team.dayStatus?.checkedInAt,
        checkedInAt: team.dayStatus?.checkedInAt ?? null,
        inspection: parseInspection(team.dayStatus?.inspection),
        inspectionNote: team.dayStatus?.inspectionNote ?? "",
        robotName: team.dayStatus?.robotName ?? "",
        pit: team.dayStatus?.pit ?? "",
        withdrawn: team.dayStatus?.withdrawn ?? false,
        presentIds: (team.dayStatus?.presentIds ?? "").split(",").filter(Boolean),
        badges: team.dayStatus?.badges ?? false,
        deskNote: team.dayStatus?.deskNote ?? "",
        runOrder: team.dayStatus?.runOrder ?? null,
        slotTime: team.dayStatus?.slotTime ?? "",
        eligible: !ineligible.has(team.id),
        standing,
        journey: journeyOf(team.id, standing, bracket, drawn),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  return {
    qualifyingStatus,
    qualifyingDirection,
    qualifyingNote: config.qualifyingNote,
    matchDirection,
    competitors,
    table,
    bracket,
    drawn,
    byId: new Map(competitors.map((competitor) => [competitor.id, competitor])),
  };
});

/** A team's members for its page: names and university only, never contact details. */
export async function publicMembers(registrationId: string) {
  return prisma.teamMember.findMany({
    where: { registrationId },
    orderBy: { order: "asc" },
    select: { id: true, firstName: true, lastName: true, university: true, major: true },
  });
}
