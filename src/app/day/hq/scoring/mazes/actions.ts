"use server";

import { requireSection } from "@/lib/admin-access";
import { refreshDaySite } from "@/lib/day-refresh";
import { cleanMaze, parseMazeNames, serializeMazeNames } from "@/lib/mazes";
import { prisma } from "@/lib/prisma";
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

/** Both sides' mazes for every match on the form: matchId, mazeA and mazeB, in threes. */
export async function saveMatchMazes(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const ids = formData.getAll("matchId").map(String);
  const mazeA = formData.getAll("mazeA").map(cleanMaze);
  const mazeB = formData.getAll("mazeB").map(cleanMaze);
  if (ids.length !== mazeA.length || ids.length !== mazeB.length) {
    return { ok: false, message: "The form came through incomplete. Reload the page and try again." };
  }
  const known = new Set((await prisma.knockoutMatch.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((row) => row.id));
  const writes = ids.flatMap((id, index) =>
    known.has(id) ? [prisma.knockoutMatch.update({ where: { id }, data: { mazeA: mazeA[index]!, mazeB: mazeB[index]! } })] : [],
  );
  if (!writes.length) return { ok: false, message: "Those matches are gone. Reload the page." };
  await prisma.$transaction(writes);
  refreshDaySite();
  return { ok: true, message: `Saved the mazes for ${writes.length} match${writes.length === 1 ? "" : "es"}.` };
}
