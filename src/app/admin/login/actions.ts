"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export interface LoginActionState {
  status: "idle" | "error";
  error?: string;
}

/**
 * Throttles password guessing against the one door to everything.
 *
 * This endpoint had no limit at all while the leaderboard had one, which is
 * exactly backwards: a scripted attempt here yields every registrant's personal
 * data, the payment records, and a mail button pointed at all of them. scrypt
 * costs about a tenth of a second, but that is throughput, not a defence —
 * requests run in parallel.
 *
 * Two counters rather than one, and the reason matters. Keyed only on address,
 * an attacker rotates addresses; keyed only on username, an attacker locks a
 * real admin out of their own panel by guessing at their name deliberately.
 * Requiring both to pass means neither of those works on its own.
 *
 * The window is generous because the realistic user is an admin who has
 * forgotten which password they used, not an attacker — ten attempts is far
 * more than a person needs and far fewer than a script wants. Note the counters
 * live in process memory (see rate-limit.ts), so an attacker spread across
 * serverless instances gets a multiple of this; it raises the cost of guessing
 * rather than making it impossible.
 */
const ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const byAddress = createRateLimiter({ limit: ATTEMPTS, windowMs: WINDOW_MS });
const byUsername = createRateLimiter({ limit: ATTEMPTS, windowMs: WINDOW_MS });

const TOO_MANY = "Too many sign-in attempts. Wait a few minutes and try again.";

export async function loginAdmin(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { status: "error", error: "Enter a username and password." };
  }

  // Checked before the database is touched, so a flood costs a map lookup
  // rather than a query and a key derivation.
  const addressKey = clientKey(headers());
  const usernameKey = username.toLowerCase();
  const address = byAddress.check(addressKey);
  const named = byUsername.check(usernameKey);
  if (!address.allowed || !named.allowed) {
    return { status: "error", error: TOO_MANY };
  }

  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { status: "error", error: "Incorrect username or password." };
  }

  // Proving you know the password clears the count. Otherwise the budget is
  // spent by whoever signs in most, which is the legitimate admin across their
  // laptop, phone and a spare browser — and the throttle ends up locking out
  // the only person it exists to protect. An attacker never reaches this line.
  byAddress.forget(addressKey);
  byUsername.forget(usernameKey);

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

  cookies().set(
    SESSION_COOKIE_NAME,
    signSession(admin.id, admin.tokenVersion),
    sessionCookieOptions(),
  );
  redirect("/admin");
}
