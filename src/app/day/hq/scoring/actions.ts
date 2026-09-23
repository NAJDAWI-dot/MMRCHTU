"use server";

import { randomInt } from "node:crypto";
import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { refreshDaySite } from "@/lib/day-refresh";
import { loadCompetition } from "@/lib/competition";
import { nextToCall, popHistory, pushHistory, type QueueEntry } from "@/lib/run-queue";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { parseClock } from "@/lib/day-slots";
import {
  FINAL_ROUND,
  QUALIFIERS,
  changedMatches,
  matchesInRound,
  parseQualifyingStatus,
  phaseInfo,
  resolveBracket,
  seedFirstRound,
  type MatchInput,
} from "@/lib/bracket";
import { compareResults, formatPoints, sheetFromFields, workingOf, type SheetProblem } from "@/lib/score-sheet";
import type { DeskState } from "../state";

const SECTION = "/day/hq/scoring";

const PROBLEMS: Record<SheetProblem, string> = {
  "bad-time": "One of the run times is not a time. Use seconds (25.41) or minutes and seconds (1:05.3).",
  "too-long": "Those runs add up to more than the eight minute match. Check the times.",
};

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
 * A team's qualifying match sheet: the time of every run that reached the
 * centre, and how far short it stopped if none did. The score is worked out
 * here from those, never typed, so it cannot disagree with them.
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

  const parsed = sheetFromFields(formData.getAll("time"), formData.get("remaining"));
  if (!parsed.ok) return { ok: false, message: PROBLEMS[parsed.problem] };
  const sheet = parsed.sheet;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  const existing = await prisma.qualifyingRun.findMany({ where: { registrationId: team.id }, orderBy: { createdAt: "asc" } });
  const data = { score: sheet.score, runTimes: sheet.times, remaining: sheet.remaining, note, recordedBy: admin.username };
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
    prisma.teamDayStatus.updateMany({ data: { runOrder: null } }),
    ...order.map((registrationId, index) =>
      prisma.teamDayStatus.upsert({
        where: { registrationId },
        update: { runOrder: index + 1 },
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
  await prisma.$transaction([prisma.teamDayStatus.updateMany({ data: { runOrder: null } }), upsertConfig({ runOrderDrawnAt: null, queueTeamId: "", queueCalledAt: null, queueHistory: "" })]);
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
    (match.timesB?.length ?? 0) > 0);

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
  const rows = await prisma.knockoutMatch.findMany();
  const target = rows.find((row) => row.id === id);
  if (!target) return { ok: false, message: "That match is gone. Reload the page." };

  const config = await prisma.competitionDayConfig.findUnique({ where: { id: "singleton" } });
  if (parseQualifyingStatus(config?.qualifyingStatus) !== "LOCKED") {
    return { ok: false, message: "Draw the bracket before entering results." };
  }

  const a = sheetFromFields(formData.getAll("timesA"), formData.get("remainingA"));
  const b = sheetFromFields(formData.getAll("timesB"), formData.get("remainingB"));
  if (!a.ok) return { ok: false, message: PROBLEMS[a.problem] };
  if (!b.ok) return { ok: false, message: PROBLEMS[b.problem] };

  const picked = String(formData.get("winnerId") ?? "") || null;
  const status = String(formData.get("status") ?? "PENDING").toUpperCase();
  const arena = String(formData.get("arena") ?? "").trim().slice(0, 60);

  const enteredA = a.sheet.runs > 0 || a.sheet.remaining !== null;
  const enteredB = b.sheet.runs > 0 || b.sheet.remaining !== null;
  const played = enteredA || enteredB;

  let winnerId: string | null = picked;
  if (played && target.teamAId && target.teamBId) {
    const cmp = compareResults(a.sheet, b.sheet);
    if (cmp !== 0) winnerId = cmp < 0 ? target.teamAId : target.teamBId;
    else if (!picked) return { ok: false, message: "The two sheets are level on everything the rulebook compares. Pick the winner." };
  }

  const edited: MatchInput[] = rows.map((row) =>
    row.id === id
      ? {
          ...row,
          scoreA: played ? a.sheet.score : null,
          scoreB: played ? b.sheet.score : null,
          timesA: a.sheet.times,
          timesB: b.sheet.times,
          remainingA: a.sheet.remaining,
          remainingB: b.sheet.remaining,
          winnerId,
        }
      : row,
  );
  const { matches, conflicts } = resolveBracket(edited, "HIGHER");
  const later = conflicts.filter((match) => !(match.round === target.round && match.slot === target.slot));

  if (later.length > 0 && formData.get("clearLater") !== "yes") {
    const where = later.map((match) => phaseInfo(match.round).name).join(", ");
    return {
      ok: false,
      message: `That changes who played in ${where}, which already have results. Tick “Clear the later results” to save it anyway.`,
    };
  }

  const resolvedTarget = matches.find((match) => match.round === target.round && match.slot === target.slot)!;
  const changed = changedMatches(rows, matches);
  const statusFor = (winner: string | null, current: string, isTarget: boolean) =>
    winner ? "DONE" : isTarget ? (status === "LIVE" ? "LIVE" : "PENDING") : current === "DONE" ? "PENDING" : current;

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
          timesA: match.timesA,
          timesB: match.timesB,
          remainingA: match.remainingA,
          remainingB: match.remainingB,
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
            data: { arena, status: statusFor(resolvedTarget.winnerId, target.status, true), updatedBy: admin.username },
          }),
        ]),
  ]);

  refreshDaySite();
  return { ok: true, message: resolvedTarget.winnerId ? "Result saved. The winner is through." : "Saved." };
}
