"use server";

import { randomInt } from "node:crypto";
import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { loadCompetition } from "@/lib/competition";
import { nextToCall, popHistory, pushHistory, type QueueEntry } from "@/lib/run-queue";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { parseClock, zonedInstant } from "@/lib/day-slots";
import { competitionDayKey, logJson, planMatchResult, qualifyingSlot, type StoredMatch } from "@/lib/match-results";
import {
  FINAL_ROUND,
  QUALIFIERS,
  changedMatches,
  matchesInRound,
  parseQualifyOverride,
  parseQualifyingStatus,
  phaseInfo,
  resolveBracket,
  seedFirstRound,
  type MatchInput,
  type ResolvedMatch,
} from "@/lib/bracket";
import { clockTime } from "@/lib/day-mode";
import { cleanLog, formatPoints, scoreSheet, sheetFromFields, workingOf } from "@/lib/score-sheet";
import { SHEET_PROBLEMS as PROBLEMS, readScoreFile, readTimingFile } from "@/lib/score-transfer";
import type { DeskState } from "../state";

const SECTION = "/day/hq/scoring";

const upsertConfig = (data: Record<string, unknown>) =>
  prisma.competitionDayConfig.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });

// ------------------------------------------------------------- settings

export async function saveScoringSettings(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  await upsertConfig({ qualifyingNote: String(formData.get("qualifyingNote") ?? "").trim().slice(0, 1200) });
  refreshDaySite();
  return { ok: true, message: "Saved. The standings page shows the new note." };
}

// ------------------------------------------------------------- qualifying

/**
 * A team's qualifying match sheet: every run, successful or not, with the time
 * of each one that reached the centre and the cell each failed one got to. The score is worked out here from those, never typed, so it cannot
 * disagree with them.
 *
 * One sheet per team. Saving again replaces it, which is how a judge corrects
 * a time.
 */
export async function saveSheet(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);
  const state = await loadCompetition();

  if (state.qualifyingStatus === "LOCKED") {
    return { ok: false, message: "Qualifying is closed and the bracket is drawn. Reopen qualifying to change a sheet." };
  }
  const teamId = String(formData.get("teamId") ?? "");
  const team = state.byId.get(teamId);
  if (!team) return { ok: false, message: "Pick a team from the list." };
  if (!team.eligible) return { ok: false, message: `${team.name} cannot qualify: ${team.withdrawn ? "withdrawn" : "failed inspection"}.` };

  const parsed = sheetFromFields(formData.getAll("time"), formData.getAll("result"), formData.getAll("cell"));
  if (!parsed.ok) return { ok: false, message: PROBLEMS[parsed.problem] };
  const sheet = parsed.sheet;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  const existing = await prisma.qualifyingRun.findMany({ where: { registrationId: team.id }, orderBy: { createdAt: "asc" } });
  const data = { score: sheet.score, runTimes: sheet.times, remaining: sheet.remaining, runLog: logJson(sheet.log), note, recordedBy: admin.username };
  await prisma.$transaction([
    existing[0]
      ? prisma.qualifyingRun.update({ where: { id: existing[0].id }, data })
      : prisma.qualifyingRun.create({ data: { registrationId: team.id, ...data } }),
    // Anything older than the one sheet a team should have.
    prisma.qualifyingRun.deleteMany({ where: { id: { in: existing.slice(1).map((row) => row.id) } } }),
    // The first sheet is what opens qualifying, if nobody has yet.
    ...(state.qualifyingStatus === "NOT_SET" ? [upsertConfig({ qualifyingStatus: "OPEN" })] : []),
  ]);
  refreshDaySite();
  return {
    ok: true,
    message: `${team.name}: ${sheet.score !== null ? `${formatPoints(sheet.score)} points (${workingOf(sheet)})` : workingOf(sheet)}`,
  };
}

/**
 * The judges' say on whether a team goes through from qualifying: "IN" or
 * "OUT" whatever its place, or "" to leave it to the table. Only while the
 * bracket is not drawn; after that, reopen qualifying to change who is in it.
 */
export async function setQualifyOverride(formData: FormData) {
  await requireSection(SECTION);
  const state = await loadCompetition();
  if (state.qualifyingStatus === "LOCKED") return;
  const team = state.byId.get(String(formData.get("teamId") ?? ""));
  if (!team) return;
  const qualifyOverride = parseQualifyOverride(formData.get("override"));
  await prisma.teamDayStatus.upsert({
    where: { registrationId: team.id },
    update: { qualifyOverride },
    create: { registrationId: team.id, qualifyOverride },
  });
  refreshDaySite();
}

export async function deleteSheet(formData: FormData) {
  await requireSection(SECTION);
  const state = await loadCompetition();
  if (state.qualifyingStatus === "LOCKED") return;
  await prisma.qualifyingRun.deleteMany({ where: { registrationId: String(formData.get("teamId") ?? "") } });
  refreshDaySite();
}

// ------------------------------------------------------- the running order

/**
 * The rulebook's random running order: once check-in closes, every team that
 * checked in and can still qualify gets a place, drawn at random, and a slot
 * time from the start time and the slot length. A team that did not check in
 * gets no slot.
 */
export async function drawRunOrder(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const state = await loadCompetition();
  const start = parseClock(formData.get("start"));
  const minutes = Math.round(Number(formData.get("minutes")));
  if (!start) return { ok: false, message: "Give the time the first team runs, like 09:30." };
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) return { ok: false, message: "A slot is between 1 and 60 minutes." };

  const field = state.competitors.filter((team) => team.checkedIn && team.eligible);
  if (field.length === 0) return { ok: false, message: "No team has checked in yet, so there is nobody to draw." };

  // Fisher-Yates with the crypto generator: nobody can say the draw was steered.
  const order = field.map((team) => team.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  await prisma.$transaction([
    prisma.teamDayStatus.updateMany({ data: { runOrder: null, slotTime: "" } }),
    ...order.map((registrationId, index) =>
      prisma.teamDayStatus.upsert({
        where: { registrationId },
        update: { runOrder: index + 1, slotTime: "" },
        create: { registrationId, runOrder: index + 1 },
      }),
    ),
    // A new order starts a new queue.
    upsertConfig({ runOrderStart: start, runSlotMinutes: minutes, runOrderDrawnAt: new Date(), queueTeamId: "", queueCalledAt: null, queueHistory: "" }),
  ]);
  refreshDaySite();
  return { ok: true, message: `Drawn: ${order.length} teams, the first at ${start}, every ${minutes} minutes.` };
}

export async function clearRunOrder(_previous: DeskState, _formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  await prisma.$transaction([prisma.teamDayStatus.updateMany({ data: { runOrder: null, slotTime: "" } }), upsertConfig({ runOrderDrawnAt: null, queueTeamId: "", queueCalledAt: null, queueHistory: "" })]);
  refreshDaySite();
  return { ok: true, message: "The running order is cleared." };
}

// ------------------------------------------------------- the call queue

/**
 * Puts a team on the maze. The teams on deck and in the hole follow from the
 * running order, so this, and the call history "Back one" steps through, is
 * all the queue stores.
 */
async function callTeam(id: string, name: string, current: string, history: string): Promise<DeskState> {
  await upsertConfig({
    queueTeamId: id,
    queueCalledAt: id ? new Date() : null,
    queueHistory: current && current !== id ? pushHistory(history, current) : history,
  });
  refreshDaySite();
  return { ok: true, message: id ? `${name} is on the maze.` : "Nobody is on the maze. The queue is stood down." };
}

async function queueState() {
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  const entries: QueueEntry[] = state.competitors.map((team) => ({
    id: team.id,
    name: team.name,
    runOrder: team.runOrder,
    eligible: team.eligible,
    ran: !!team.standing?.recorded,
  }));
  return { state, entries, current: config.queueTeamId, history: config.queueHistory };
}

export async function callNext(_previous: DeskState, _formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const { state, entries, current, history } = await queueState();
  if (state.qualifyingStatus === "LOCKED") return { ok: false, message: "Qualifying is closed, so there is nobody left to call." };
  if (!entries.some((entry) => entry.runOrder !== null)) return { ok: false, message: "Draw the running order first." };
  const next = nextToCall(entries, current);
  if (!next) return { ok: false, message: "Every team in the running order has run." };
  return callTeam(next.id, next.name, current, history);
}

/** Undoes the last call: whoever was on the maze before comes back. */
export async function callBack(_previous: DeskState, _formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const { entries, history } = await queueState();
  const popped = popHistory(history);
  if (!popped) return { ok: false, message: "There is no earlier call to go back to." };
  const team = entries.find((entry) => entry.id === popped.id);
  await upsertConfig({ queueTeamId: popped.id, queueCalledAt: new Date(), queueHistory: popped.history });
  refreshDaySite();
  return { ok: true, message: `Back to ${team?.name ?? "the team before"}.` };
}

/** Calls one team out of turn, for a team that has to run early or late. */
export async function callChosen(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const { state, entries, current, history } = await queueState();
  if (state.qualifyingStatus === "LOCKED") return { ok: false, message: "Qualifying is closed, so there is nobody left to call." };
  const chosen = entries.find((entry) => entry.id === String(formData.get("teamId") ?? ""));
  if (!chosen || chosen.runOrder === null) return { ok: false, message: "Pick a team from the running order." };
  if (!chosen.eligible) return { ok: false, message: `${chosen.name} cannot run: withdrawn or failed inspection.` };
  return callTeam(chosen.id, chosen.name, current, history);
}

export async function standDown(_previous: DeskState, _formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const { current, history } = await queueState();
  return callTeam("", "", current, history);
}

// ------------------------------------------------------------- the draw

async function writeBracket(input: MatchInput[]) {
  const { matches } = resolveBracket(input, "HIGHER");
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

const hasResult = (match: MatchInput) =>
  !!match.teamAId &&
  !!match.teamBId &&
  (match.scoreA !== null ||
    match.scoreB !== null ||
    !!match.winnerId ||
    (match.timesA?.length ?? 0) > 0 ||
    (match.timesB?.length ?? 0) > 0 ||
    cleanLog(match.runLogA).length > 0 ||
    cleanLog(match.runLogB).length > 0);

/**
 * Closes qualifying and draws the round of 32 from the table as it stands.
 *
 * Refuses to draw over a bracket that already has results in it unless told
 * to, because a redraw throws every one of them away.
 */
export async function drawBracket(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const state = await loadCompetition();

  const qualified = state.table.filter((row) => row.qualified).map((row) => row.teamId);
  if (qualified.length < 2) {
    return { ok: false, message: "At least two teams need a match sheet before there is anything to draw." };
  }

  const played = state.bracket.filter(hasResult);
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
  await writeBracket([...first.map((match) => ({ id: "", ...match, scoreA: null, scoreB: null, winnerId: null })), ...empty]);
  await upsertConfig({ qualifyingStatus: "LOCKED" });
  refreshDaySite();
  return {
    ok: true,
    message: `Drawn. ${qualified.length >= QUALIFIERS ? "32 teams" : `${qualified.length} teams, with byes for the top seeds,`} are in the round of 32.`,
  };
}

/** Takes the bracket down and lets match sheets be changed again. */
export async function reopenQualifying(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const state = await loadCompetition();
  const played = state.bracket.filter(hasResult);
  if (played.length > 0 && formData.get("force") !== "yes") {
    return { ok: false, message: "Matches have been played. Tick “Throw away the results” to reopen anyway." };
  }
  await prisma.$transaction([prisma.knockoutMatch.deleteMany({}), upsertConfig({ qualifyingStatus: "OPEN" })]);
  refreshDaySite();
  return { ok: true, message: "Qualifying is open again and the bracket is cleared." };
}

// ------------------------------------------------------------- results

/**
 * One knockout match, from both sides' match sheets.
 *
 * The winner is worked out the rulebook's way: the higher score, the faster
 * official time on an exact tie, then whoever got closer to the centre when
 * neither side reached it. A tie that survives all of that, or a match decided
 * without being run (a no-show), takes the scorer's pick.
 */
export async function saveMatch(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);
  const id = String(formData.get("id") ?? "");
  const rows: StoredMatch[] = await prisma.knockoutMatch.findMany();
  const target = rows.find((row) => row.id === id);
  if (!target) return { ok: false, message: "That match is gone. Reload the page." };

  const config = await prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } });
  if (parseQualifyingStatus(config?.qualifyingStatus) !== "LOCKED") {
    return { ok: false, message: "Draw the bracket before entering results." };
  }

  const a = sheetFromFields(formData.getAll("timesA"), formData.getAll("resultA"), formData.getAll("cellA"));
  const b = sheetFromFields(formData.getAll("timesB"), formData.getAll("resultB"), formData.getAll("cellB"));
  if (!a.ok) return { ok: false, message: PROBLEMS[a.problem] };
  if (!b.ok) return { ok: false, message: PROBLEMS[b.problem] };

  const clockText = String(formData.get("time") ?? "").trim();
  const clock = clockText ? parseClock(clockText) : null;
  if (clockText && !clock) return { ok: false, message: "The start time is not a time. Use 24-hour time, like 14:20." };
  const scheduledAt = clock ? zonedInstant(competitionDayKey(config?.eventDate ?? null), clock) : null;

  const picked = String(formData.get("winnerId") ?? "") || null;
  const status = String(formData.get("status") ?? "PENDING").toUpperCase() === "LIVE" ? "LIVE" : "PENDING";
  const arena = String(formData.get("arena") ?? "").trim().slice(0, 60);

  // A team picked here is the judges' decision: it goes through whatever the sheets say.
  const plan = planMatchResult(rows, target, a.sheet, b.sheet, picked, !!picked);
  if (!plan.ok) return { ok: false, message: plan.message };
  if (plan.later.length > 0 && formData.get("clearLater") !== "yes") {
    const where = plan.later.map((match) => phaseInfo(match.round).name).join(", ");
    return {
      ok: false,
      message: `That changes who played in ${where}, which already have results. Tick “Clear the later results” to save it anyway.`,
    };
  }

  const statusFor = (winner: string | null, current: string, isTarget: boolean) =>
    winner ? "DONE" : isTarget ? status : current === "DONE" ? "PENDING" : current;
  const own = { arena, scheduledAt, updatedBy: admin.username };

  await prisma.$transaction([
    ...plan.changed.map((match) => {
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
          timesA: match.timesA,
          timesB: match.timesB,
          remainingA: match.remainingA,
          remainingB: match.remainingB,
          runLogA: logJson(match.runLogA),
          runLogB: logJson(match.runLogB),
          winnerId: match.winnerId,
          winnerOverride: match.winnerOverride,
          status: statusFor(match.winnerId, row.status, isTarget),
          ...(isTarget ? own : {}),
        },
      });
    }),
    // The target's own status, time and maze, when nothing about its result moved.
    ...(plan.changed.some((match) => match.round === target.round && match.slot === target.slot)
      ? []
      : [prisma.knockoutMatch.update({ where: { id }, data: { ...own, status: statusFor(plan.target.winnerId, target.status, true) } })]),
  ]);

  refreshDaySite();
  return {
    ok: true,
    message: plan.target.winnerOverride
      ? "Saved. The judges' pick is through, whatever the sheets say."
      : plan.target.winnerId
        ? "Result saved. The winner is through."
        : "Saved.",
  };
}

// ------------------------------------------------------ import from a file

/** The text of an uploaded CSV, or why it cannot be read. */
async function readCsvUpload(value: FormDataEntryValue | null): Promise<string | { error: string }> {
  if (!(value instanceof File) || value.size === 0) return { error: "Choose a CSV file first." };
  if (value.size > 1_000_000) return { error: "That file is over 1 MB, which is far more than a day of scores. Check it is the right file." };
  if (/\.(xlsx|xls|numbers|ods)$/i.test(value.name)) return { error: "That is a spreadsheet file. Save it as CSV UTF-8 and upload that." };
  return value.text();
}

const refused = (errors: string[]): DeskState => ({ ok: false, message: `Nothing was imported. ${errors.join(" ")}` });

/**
 * A scores file: every team's qualifying sheet in it, and every knockout match
 * side in it, replaced by the runs in the file. Checked in full before anything
 * is written, and written in one go, so a file with a mistake changes nothing.
 * Knockout matches are put in round by round, so a winner imported in the round
 * of 32 can already have its round of 16 result in the same file.
 */
export async function importScores(_previous: DeskState, formData: FormData): Promise<DeskState> {
  const admin = await requireSection(SECTION);
  const text = await readCsvUpload(formData.get("file"));
  if (typeof text !== "string") return { ok: false, message: text.error };

  const state = await loadCompetition();
  const parsed = readScoreFile(
    text,
    state.competitors.map((team) => ({ id: team.id, name: team.name })),
  );
  if (!parsed.ok) return refused(parsed.errors);

  const errors: string[] = [];
  if (parsed.qualifying.length && state.qualifyingStatus === "LOCKED") {
    errors.push("The file has qualifying runs, but qualifying is closed and the bracket is drawn. Reopen qualifying, or take those rows out.");
  }
  for (const sheet of parsed.qualifying) {
    const team = state.byId.get(sheet.team.id)!;
    if (!team.eligible) errors.push(`Line ${sheet.line}: ${team.name} cannot qualify: ${team.withdrawn ? "withdrawn" : "failed inspection"}.`);
  }

  // Knockout sides, grouped into matches and played through in bracket order.
  const original: StoredMatch[] = await prisma.knockoutMatch.findMany();
  let rows: StoredMatch[] = original;
  if (parsed.knockout.length && (!state.drawn || state.qualifyingStatus !== "LOCKED")) {
    errors.push("The file has knockout results, but the bracket is not drawn yet.");
  }
  const byMatch = new Map<string, typeof parsed.knockout>();
  for (const side of parsed.knockout) {
    const key = `${side.round}:${side.slot}`;
    byMatch.set(key, [...(byMatch.get(key) ?? []), side]);
  }
  const matchKeys = [...byMatch.keys()].sort((a, b) => {
    const [ra, sa] = a.split(":").map(Number) as [number, number];
    const [rb, sb] = b.split(":").map(Number) as [number, number];
    return ra - rb || sa - sb;
  });
  for (const key of errors.length ? [] : matchKeys) {
    const sides = byMatch.get(key)!;
    const { round, slot, line } = sides[0]!;
    const where = `${phaseInfo(round).name} match ${slot + 1}`;
    const target = rows.find((row) => row.round === round && row.slot === slot);
    if (!target || !target.teamAId || !target.teamBId) {
      errors.push(`Line ${line}: ${where} does not have both its teams yet.`);
      continue;
    }
    let a = scoreSheet({ times: target.timesA ?? [], remaining: target.remainingA ?? null, log: target.runLogA });
    let b = scoreSheet({ times: target.timesB ?? [], remaining: target.remainingB ?? null, log: target.runLogB });
    let bad = false;
    for (const side of sides) {
      const sheet = scoreSheet({ times: [], remaining: null, log: side.log });
      if (side.team.id === target.teamAId) a = sheet;
      else if (side.team.id === target.teamBId) b = sheet;
      else {
        errors.push(`Line ${side.line}: ${side.team.name} is not playing in ${where}.`);
        bad = true;
      }
    }
    if (bad) continue;
    const plan = planMatchResult(rows, target, a, b, target.winnerId, target.winnerOverride);
    if (!plan.ok) {
      errors.push(`Line ${line}: ${where}. ${plan.message}`);
      continue;
    }
    if (plan.later.length && formData.get("clearLater") !== "yes") {
      const later = plan.later.map((match) => phaseInfo(match.round).name).join(", ");
      errors.push(`Line ${line}: ${where} changes who played in ${later}, which already have results. Tick "Clear later results" to import anyway.`);
      continue;
    }
    const before = rows;
    rows = plan.matches.map((match) => {
      const stored = before.find((row) => row.round === match.round && row.slot === match.slot)!;
      return { ...match, id: stored.id, status: match.winnerId ? "DONE" : stored.status === "DONE" ? "PENDING" : stored.status };
    });
  }
  if (errors.length) return refused(errors.slice(0, 8));

  const existing = await prisma.qualifyingRun.findMany({
    where: { registrationId: { in: parsed.qualifying.map((sheet) => sheet.team.id) } },
    orderBy: { createdAt: "asc" },
  });
  // Only knockout imports move the bracket; untouched rows are exactly what was read.
  const changed = matchKeys.length ? changedMatches(original, rows as unknown as ResolvedMatch[]) : [];
  await prisma.$transaction([
    ...parsed.qualifying.flatMap((item) => {
      const sheet = scoreSheet({ times: [], remaining: null, log: item.log });
      const mine = existing.filter((row) => row.registrationId === item.team.id);
      const data = {
        score: sheet.score,
        runTimes: sheet.times,
        remaining: sheet.remaining,
        runLog: logJson(sheet.log),
        recordedBy: admin.username,
        ...(item.note === null ? {} : { note: item.note }),
      };
      return [
        mine[0]
          ? prisma.qualifyingRun.update({ where: { id: mine[0].id }, data })
          : prisma.qualifyingRun.create({ data: { registrationId: item.team.id, ...data } }),
        prisma.qualifyingRun.deleteMany({ where: { id: { in: mine.slice(1).map((row) => row.id) } } }),
      ];
    }),
    ...changed.map((match) => {
      const row = rows.find((r) => r.round === match.round && r.slot === match.slot)!;
      return prisma.knockoutMatch.update({
        where: { id: row.id },
        data: {
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          seedA: match.seedA,
          seedB: match.seedB,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          timesA: match.timesA,
          timesB: match.timesB,
          remainingA: match.remainingA,
          remainingB: match.remainingB,
          runLogA: logJson(match.runLogA),
          runLogB: logJson(match.runLogB),
          winnerId: match.winnerId,
          winnerOverride: match.winnerOverride,
          status: row.status,
          updatedBy: admin.username,
        },
      });
    }),
    ...(parsed.qualifying.length && state.qualifyingStatus === "NOT_SET" ? [upsertConfig({ qualifyingStatus: "OPEN" })] : []),
  ]);
  refreshDaySite();

  const parts = [
    parsed.qualifying.length ? `${parsed.qualifying.length} qualifying sheet${parsed.qualifying.length === 1 ? "" : "s"}` : "",
    matchKeys.length ? `${matchKeys.length} knockout match${matchKeys.length === 1 ? "" : "es"}` : "",
  ].filter(Boolean);
  return { ok: true, message: `Imported ${parts.join(" and ")}: ${parsed.runs} run${parsed.runs === 1 ? "" : "s"} in all.` };
}

/**
 * A timings file: each qualifying team's place and slot time, and each
 * knockout match's start time and maze. A slot time that is exactly what the
 * order would give anyway is not stored, so drawing again still moves it.
 */
export async function importTimings(_previous: DeskState, formData: FormData): Promise<DeskState> {
  await requireSection(SECTION);
  const text = await readCsvUpload(formData.get("file"));
  if (typeof text !== "string") return { ok: false, message: text.error };

  const [state, config, matches] = await Promise.all([loadCompetition(), getCompetitionDayConfig(), prisma.knockoutMatch.findMany()]);
  const parsed = readTimingFile(
    text,
    state.competitors.map((team) => ({ id: team.id, name: team.name })),
  );
  if (!parsed.ok) return refused(parsed.errors);

  const errors: string[] = [];
  // A place the file gives out must not still belong to a team the file leaves alone.
  const listed = new Set(parsed.qualifying.map((row) => row.team.id));
  for (const row of parsed.qualifying) {
    const holder = state.competitors.find((team) => !listed.has(team.id) && team.runOrder !== null && team.runOrder === row.order);
    if (holder) errors.push(`Line ${row.line}: place ${row.order} is ${holder.name}'s. Put ${holder.name} in the file too, or pick another place.`);
  }
  if (parsed.knockout.length && !state.drawn) errors.push("The file has knockout matches, but the bracket is not drawn yet.");
  const targets = parsed.knockout.map((row) => ({ row, match: matches.find((match) => match.round === row.round && match.slot === row.slot) }));
  for (const { row, match } of targets) {
    if (state.drawn && !match) errors.push(`Line ${row.line}: there is no ${phaseInfo(row.round).name} match ${row.slot + 1}.`);
  }
  if (errors.length) return refused(errors.slice(0, 8));

  const day = competitionDayKey(config.eventDate);
  const firstTime = parsed.qualifying.map((row) => row.time).filter(Boolean).sort()[0] ?? "";
  const start = config.runOrderStart || firstTime;
  const settings = { runOrderStart: start, runSlotMinutes: config.runSlotMinutes };
  const ownTime = (order: number | null, time: string) => {
    if (!time || !order) return time;
    const worked = qualifyingSlot({ runOrder: order, slotTime: "" }, settings, day);
    return worked && clockTime(worked) === time ? "" : time;
  };

  await prisma.$transaction([
    ...parsed.qualifying.map((row) => {
      const data = { runOrder: row.order, slotTime: ownTime(row.order, row.time) };
      return prisma.teamDayStatus.upsert({ where: { registrationId: row.team.id }, update: data, create: { registrationId: row.team.id, ...data } });
    }),
    ...targets.map(({ row, match }) =>
      prisma.knockoutMatch.update({
        where: { id: match!.id },
        data: { scheduledAt: row.time ? zonedInstant(day, row.time) : null, arena: row.maze },
      }),
    ),
    ...(parsed.qualifying.some((row) => row.order !== null)
      ? [upsertConfig({ runOrderStart: start, ...(config.runOrderDrawnAt ? {} : { runOrderDrawnAt: new Date() }) })]
      : []),
  ]);
  refreshDaySite();

  const parts = [
    parsed.qualifying.length ? `${parsed.qualifying.length} qualifying slot${parsed.qualifying.length === 1 ? "" : "s"}` : "",
    parsed.knockout.length ? `${parsed.knockout.length} knockout match time${parsed.knockout.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return { ok: true, message: `Imported ${parts.join(" and ")}.` };
}
