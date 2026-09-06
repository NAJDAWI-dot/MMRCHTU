import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  GAME_MODES,
  MAX_NAME_LENGTH,
  isGameMode,
  parseLeaderboardSort,
  sanitisePlayerName,
} from "@/lib/leaderboard";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

// The board changes on every submission, so it must never be statically cached.
export const dynamic = "force-dynamic";

const TOP_N = 20;

// Scores come from a client-side canvas game, so they are player-supplied and
// inherently spoofable — there is no server-side simulation to check them
// against. These caps only keep obvious junk (negative, absurd, or overflowing
// values) out of the table; treat the board as a fun scoreboard, not an
// authoritative record.
const MAX_SCORE = 10_000_000;
const MAX_LEVEL = 999;

/**
 * The caps above keep a single absurd value out; this keeps a loop out.
 *
 * Ten a minute is far more than anyone finishing real games can produce — a
 * round takes minutes — while still leaving room for a player retrying after a
 * validation error without being locked out of their own score.
 */
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });

export async function GET(request: NextRequest) {
  const modeParam = request.nextUrl.searchParams.get("mode") ?? "classic";
  const mode = isGameMode(modeParam) ? modeParam : "classic";

  const sort = parseLeaderboardSort(request.nextUrl.searchParams.get("sort"));

  /*
    Sector first, then score, then who got there first.

    Score is still the tiebreak rather than being ignored: two players who both
    died in sector 6 did not do equally well, and ordering those purely by
    submission time would make the board a queue.
  */
  const orderBy =
    sort === "sector"
      ? ([{ level: "desc" }, { score: "desc" }, { createdAt: "asc" }] as const)
      : ([{ score: "desc" }, { createdAt: "asc" }] as const);

  const scores = await prisma.gameScore.findMany({
    where: { mode },
    orderBy: [...orderBy],
    take: TOP_N,
    select: { id: true, playerName: true, score: true, level: true, createdAt: true },
  });

  return NextResponse.json({ mode, sort, scores });
}

export async function POST(request: NextRequest) {
  const limit = limiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Play another round and try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const playerName = sanitisePlayerName(String(body.playerName ?? ""));
  const score = Number(body.score);
  const level = Number(body.level ?? 1);
  const mode = String(body.mode ?? "classic");

  if (!playerName) {
    return NextResponse.json({ error: `Enter a name (1-${MAX_NAME_LENGTH} characters).` }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: "Invalid score." }, { status: 400 });
  }
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    return NextResponse.json({ error: "Invalid level." }, { status: 400 });
  }
  if (!isGameMode(mode)) {
    return NextResponse.json({ error: `Mode must be one of: ${GAME_MODES.join(", ")}.` }, { status: 400 });
  }

  const entry = await prisma.gameScore.create({
    data: { playerName, score, level, mode },
    select: { id: true, playerName: true, score: true, level: true, createdAt: true },
  });

  // Rank is 1-based and counts strictly higher scores, so ties share the rank
  // of the first player to reach that score.
  const better = await prisma.gameScore.count({ where: { mode, score: { gt: score } } });

  return NextResponse.json({ entry, rank: better + 1 }, { status: 201 });
}
