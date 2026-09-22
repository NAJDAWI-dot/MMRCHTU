"use server";

import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { loadCompetition } from "@/lib/competition";
import {
  FINAL_ROUND,
  QUALIFIERS,
  changedMatches,
  matchesInRound,
  parseDirection,
  parseQualifyingStatus,
  parseScore,
  phaseInfo,
  resolveBracket,
  seedFirstRound,
  type MatchInput,
} from "@/lib/bracket";
import type { DeskState } from "../state";

const SECTION = "/admin/day/scoring";

// ------------------------------------------------------------- settings

export async function saveScoringSettings(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);

  const data = {
    qualifyingDirection: parseDirection(formData.get("qualifyingDirection")),
    matchDirection: parseDirection(formData.get("matchDirection")),
    qualifyingNote: String(formData.get("qualifyingNote") ?? "").trim().slice(0, 1200),
  };
  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  refreshDaySite();
  return { ok: true, message: "Saved. The standings and the bracket follow the new settings." };
}

// ------------------------------------------------------------- qualifying

export async function addRun(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);
  const state = await loadCompetition();

  if (state.qualifyingStatus === "LOCKED") {
    return { ok: false, message: "Qualifying is locked and the bracket is drawn. Reopen qualifying to add a run." };
  }

  const teamId = String(formData.get("teamId") ?? "");
  const team = state.byId.get(teamId);
  if (!team) return { ok: false, message: "Pick a team from the list." };

  const score = parseScore(formData.get("score"));
  if (score === null) return { ok: false, message: "That score is not a number." };

  await prisma.$transaction([
    prisma.qualifyingRun.create({
      data: {
        registrationId: team.id,
        score,
        note: String(formData.get("note") ?? "").trim().slice(0, 200),
        recordedBy: admin.username,
      },
    }),
    // Recording the first run is what opens qualifying, if nobody has yet.
    prisma.competitionDayConfig.upsert({
      where: { id: "singleton" },
      update: { qualifyingStatus: "OPEN" },
      create: { id: "singleton", qualifyingStatus: "OPEN" },
    }),
  ]);
  refreshDaySite();
  return { ok: true, message: `Recorded ${score} for ${team.name}.` };
}

export async function deleteRun(formData: FormData) {
  await requireSection(SECTION);
  const state = await loadCompetition();
  if (state.qualifyingStatus === "LOCKED") return;
  await prisma.qualifyingRun.deleteMany({ where: { id: String(formData.get("id") ?? "") } });
  refreshDaySite();
}

// ------------------------------------------------------------- the draw

async function writeBracket(input: MatchInput[], direction: "HIGHER" | "LOWER") {
  const { matches } = resolveBracket(input, direction);
  await prisma.$transaction([
    prisma.knockoutMatch.deleteMany({}),
    prisma.knockoutMatch.createMany({
      data: matches.map((match) => ({
        round: match.round,
        slot: match.slot,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        seedA: match.seedA,
        seedB: match.seedB,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        winnerId: match.winnerId,
        status: match.winnerId ? "DONE" : "PENDING",
      })),
    }),
  ]);
}

/**
 * Locks qualifying and draws the round of 32 from the table as it stands.
 *
 * Refuses to draw over a bracket that already has results in it unless told
 * to, because a redraw throws every one of them away.
 */
export async function drawBracket(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const state = await loadCompetition();

  const qualified = state.table.filter((row) => row.qualified).map((row) => row.teamId);
  if (qualified.length < 2) {
    return { ok: false, message: "At least two teams need a qualifying score before there is anything to draw." };
  }

  const played = state.bracket.filter(
    (match) => match.teamAId && match.teamBId && (match.scoreA !== null || match.scoreB !== null || match.winnerId),
  );
  if (played.length > 0 && formData.get("force") !== "yes") {
    return {
      ok: false,
      message: `The bracket already has ${played.length} result${played.length === 1 ? "" : "s"}. Tick “Throw away the results” to redraw anyway.`,
    };
  }

  const first = seedFirstRound(qualified.slice(0, QUALIFIERS));
  const empty: MatchInput[] = [];
  for (let round = 3; round <= FINAL_ROUND; round++) {
    for (let slot = 0; slot < matchesInRound(round); slot++) {
      empty.push({ id: "", round, slot, teamAId: null, teamBId: null, seedA: null, seedB: null, scoreA: null, scoreB: null, winnerId: null });
    }
  }
  await writeBracket(
    [...first.map((match) => ({ id: "", ...match, scoreA: null, scoreB: null, winnerId: null })), ...empty],
    state.matchDirection,
  );
  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: { qualifyingStatus: "LOCKED" },
    create: { id: "singleton", qualifyingStatus: "LOCKED" },
  });
  refreshDaySite();
  return {
    ok: true,
    message: `Drawn. ${qualified.length >= QUALIFIERS ? "32 teams" : `${qualified.length} teams, with byes for the top seeds,`} are in the round of 32.`,
  };
}

/** Takes the bracket down and lets runs be recorded again. */
export async function reopenQualifying(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const state = await loadCompetition();
  const played = state.bracket.filter(
    (match) => match.teamAId && match.teamBId && (match.scoreA !== null || match.scoreB !== null || match.winnerId),
  );
  if (played.length > 0 && formData.get("force") !== "yes") {
    return { ok: false, message: "Matches have been played. Tick “Throw away the results” to reopen anyway." };
  }
  await prisma.$transaction([
    prisma.knockoutMatch.deleteMany({}),
    prisma.competitionDayConfig.upsert({
      where: { id: "singleton" },
      update: { qualifyingStatus: "OPEN" },
      create: { id: "singleton", qualifyingStatus: "OPEN" },
    }),
  ]);
  refreshDaySite();
  return { ok: true, message: "Qualifying is open again and the bracket is cleared." };
}

// ------------------------------------------------------------- results

export async function saveMatch(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);
  const id = String(formData.get("id") ?? "");
  const rows = await prisma.knockoutMatch.findMany();
  const target = rows.find((row) => row.id === id);
  if (!target) return { ok: false, message: "That match is gone. Reload the page." };

  const config = await prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } });
  const direction = parseDirection(config?.matchDirection);
  if (parseQualifyingStatus(config?.qualifyingStatus) !== "LOCKED") {
    return { ok: false, message: "Draw the bracket before entering results." };
  }

  const scoreA = parseScore(formData.get("scoreA"));
  const scoreB = parseScore(formData.get("scoreB"));
  const picked = String(formData.get("winnerId") ?? "") || null;
  const status = String(formData.get("status") ?? "PENDING").toUpperCase();
  const arena = String(formData.get("arena") ?? "").trim().slice(0, 60);

  const edited: MatchInput[] = rows.map((row) =>
    row.id === id ? { ...row, scoreA, scoreB, winnerId: picked } : row,
  );
  const { matches, conflicts } = resolveBracket(edited, direction);
  const later = conflicts.filter((match) => !(match.round === target.round && match.slot === target.slot));

  if (later.length > 0 && formData.get("clearLater") !== "yes") {
    const where = later.map((match) => phaseInfo(match.round).name).join(", ");
    return {
      ok: false,
      message: `That changes who played in ${where}, which already have results. Tick “Clear the later results” to save it anyway.`,
    };
  }

  const resolvedTarget = matches.find((match) => match.round === target.round && match.slot === target.slot)!;
  if (resolvedTarget.tied && !resolvedTarget.winnerId) {
    return { ok: false, message: "The scores are level. Pick the winner before saving." };
  }

  const changed = changedMatches(rows, matches);
  const statusFor = (winnerId: string | null, current: string, isTarget: boolean) =>
    winnerId ? "DONE" : isTarget ? (status === "LIVE" ? "LIVE" : "PENDING") : current === "DONE" ? "PENDING" : current;

  await prisma.$transaction([
    ...changed.map((match) => {
      const row = rows.find((r) => r.round === match.round && r.slot === match.slot)!;
      const isTarget = row.id === id;
      return prisma.knockoutMatch.update({
        where: { id: row.id },
        data: {
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          seedA: match.seedA,
          seedB: match.seedB,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          winnerId: match.winnerId,
          status: statusFor(match.winnerId, row.status, isTarget),
          ...(isTarget ? { arena, updatedBy: admin.username } : {}),
        },
      });
    }),
    // The target's own status and arena, when nothing about its result moved.
    ...(changed.some((match) => match.round === target.round && match.slot === target.slot)
      ? []
      : [
          prisma.knockoutMatch.update({
            where: { id },
            data: {
              arena,
              status: statusFor(resolvedTarget.winnerId, target.status, true),
              updatedBy: admin.username,
            },
          }),
        ]),
  ]);

  refreshDaySite();
  return { ok: true, message: resolvedTarget.winnerId ? "Result saved. The winner is through." : "Saved." };
}
