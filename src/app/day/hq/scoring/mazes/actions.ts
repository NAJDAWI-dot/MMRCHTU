"use server";

import { requireSection } from "@/lib/admin-access";
import { phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { refreshDaySite } from "@/lib/day-refresh";
import { parseClock, zonedInstant } from "@/lib/day-slots";
import { planKnockoutSchedule } from "@/lib/knockout-schedule";
import { competitionDayKey } from "@/lib/match-results";
import { cleanMaze, parseMazeNames, serializeMazeNames } from "@/lib/mazes";
import { prisma } from "@/lib/prisma";
import { getCompetitionDayConfig } from "@/lib/site-config";
import type { DeskState } from "../../state";

const SECTION = "/day/hq/scoring/mazes";

/** The mazes on the floor, one per line or comma-separated. */
export async function saveMazeNames(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const names = parseMazeNames(formData.get("names"));
  if (!names.length) return { ok: false, message: "Name at least one maze." };
  const data = { mazeNames: serializeMazeNames(names) };
  await prisma.competitionDayConfig.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  refreshDaySite();
  return { ok: true, message: `Saved: ${names.join(", ")}.` };
}

/** Every team's qualifying maze, from the form's teamId and maze fields, in pairs. */
export async function saveQualifyingMazes(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const ids = formData.getAll("teamId").map(String);
  const mazes = formData.getAll("maze").map(cleanMaze);
  if (ids.length !== mazes.length) return { ok: false, message: "The form came through incomplete. Reload the page and try again." };

  const known = new Set(
    (await prisma.registration.findMany({ where: { status: "CONFIRMED", id: { in: ids } }, select: { id: true } })).map((row) => row.id),
  );
  const writes = ids.flatMap((id, index) =>
    known.has(id)
      ? [
          prisma.teamDayStatus.upsert({
            where: { registrationId: id },
            update: { qualifyingMaze: mazes[index]! },
            create: { registrationId: id, qualifyingMaze: mazes[index]! },
          }),
        ]
      : [],
  );
  await prisma.$transaction(writes);
  refreshDaySite();
  const set = mazes.filter((maze, index) => maze && known.has(ids[index]!)).length;
  return { ok: true, message: `Saved. ${set} of ${writes.length} teams have a maze.` };
}

/**
 * Both teams' mazes. The match's own "arena" is cleared: each team's maze is
 * what the team page, the hall screen and the judge's tablet show.
 */
const sideMazes = (mazeA: string, mazeB: string) => ({ arena: "", mazeA, mazeB });

/**
 * Times the knockout from a round onwards: one match after another, each head
 * to head, its top team on the first maze and its bottom team on the second.
 * Matches already played keep their times; any time or maze can be changed by
 * hand afterwards.
 */
export async function autoSchedule(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const start = parseClock(formData.get("start"));
  if (!start) return { ok: false, message: "Give the time the first match starts, like 13:00." };
  const minutes = Math.round(Number(formData.get("minutes")));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) return { ok: false, message: "A match slot is between 1 and 120 minutes." };
  const breakMinutes = Math.round(Number(formData.get("break") || 0));
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 180) return { ok: false, message: "A break is between 0 and 180 minutes." };
  const fromRound = Math.round(Number(formData.get("fromRound")));

  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  if (!state.drawn) return { ok: false, message: "Draw the bracket first." };
  const mazes = parseMazeNames(config.mazeNames);
  const plan = planKnockoutSchedule(
    state.bracket.map((match) => ({ id: match.id, round: match.round, slot: match.slot, void: match.void || match.walkover, done: !!match.winnerId })),
    { start, minutes, breakMinutes, fromRound, mazes },
  );
  if (!plan) return { ok: false, message: "Give the time the first match starts, like 13:00." };
  if (!plan.length) return { ok: false, message: "Every match from that round on is already played." };

  const known = new Set((await prisma.knockoutMatch.findMany({ select: { id: true } })).map((row) => row.id));
  const day = competitionDayKey(config.eventDate);
  const writes = plan
    .filter((match) => known.has(match.id))
    .map((match) => prisma.knockoutMatch.update({ where: { id: match.id }, data: { scheduledAt: zonedInstant(day, match.time), ...sideMazes(match.mazeA, match.mazeB) } }));
  await prisma.$transaction(writes);
  refreshDaySite();
  const last = plan[plan.length - 1]!;
  return {
    ok: true,
    message: `Timed ${writes.length} match${writes.length === 1 ? "" : "es"}: the first at ${plan[0]!.time}, the ${phaseInfo(last.round).name.toLowerCase()} at ${last.time}.`,
  };
}

/**
 * The schedule as typed on the desk: matchId, time and both teams' mazes for
 * every match on the form, in fours. An empty time clears it.
 */
export async function saveSchedule(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const ids = formData.getAll("matchId").map(String);
  const times = formData.getAll("time").map((value) => String(value).trim());
  const mazeA = formData.getAll("mazeA").map(cleanMaze);
  const mazeB = formData.getAll("mazeB").map(cleanMaze);
  if (ids.length !== times.length || ids.length !== mazeA.length || ids.length !== mazeB.length) {
    return { ok: false, message: "The form came through incomplete. Reload the page and try again." };
  }
  const bad = times.filter((time) => time && !parseClock(time));
  if (bad.length) return { ok: false, message: `${bad[0]} is not a time. Use 24-hour time, like 14:20.` };

  const config = await getCompetitionDayConfig();
  const day = competitionDayKey(config.eventDate);
  const known = new Set((await prisma.knockoutMatch.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((row) => row.id));
  const writes = ids.flatMap((id, index) => {
    if (!known.has(id)) return [];
    const clock = times[index] ? parseClock(times[index]) : null;
    return [prisma.knockoutMatch.update({ where: { id }, data: { scheduledAt: clock ? zonedInstant(day, clock) : null, ...sideMazes(mazeA[index]!, mazeB[index]!) } })];
  });
  if (!writes.length) return { ok: false, message: "Those matches are gone. Reload the page." };
  await prisma.$transaction(writes);
  refreshDaySite();
  return { ok: true, message: `Saved the times and mazes of ${writes.length} match${writes.length === 1 ? "" : "es"}.` };
}
