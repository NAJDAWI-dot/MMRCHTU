import { timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_COOKIE_NAME = "mmrc_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  adminId: string;
  /**
   * The admin's tokenVersion at the moment this session was issued.
   *
   * Compared against the stored value on every request, which is what makes a
   * stateless token revocable: incrementing the column leaves every token
   * carrying the old number unable to match, and they all stop working at once.
   */
  tokenVersion: number;
  iat: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export function signSession(adminId: string, tokenVersion: number): string {
  const payload = base64url(
    JSON.stringify({ adminId, tokenVersion, iat: Date.now() } satisfies SessionPayload),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySessionSignature(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (typeof parsed.adminId !== "string" || typeof parsed.iat !== "number") return null;
    // A token from before tokenVersion existed has no version to compare, so it
    // cannot be shown to be current. Rejecting it signs those sessions out once,
    // at deploy, which is the correct answer for a change whose entire purpose
    // is that an old token stops being trusted.
    if (typeof parsed.tokenVersion !== "number") return null;
    if (Date.now() - parsed.iat > SESSION_MAX_AGE_SECONDS * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Server-component/action guard: verifies the session and loads the admin, redirecting to login if invalid. */
export async function requireAdmin() {
  const cookieValue = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionSignature(cookieValue);
  if (!session) {
    redirect("/admin/login");
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin) {
    redirect("/admin/login");
  }

  // The revocation check. A token signed before the admin last signed out
  // everywhere carries a lower version and is refused from here on, even though
  // its signature is still perfectly valid.
  if (admin.tokenVersion !== session.tokenVersion) {
    redirect("/admin/login");
  }

  return admin;
}

/** API-route guard: verifies the session and loads the admin, returning null (never redirects) if invalid. */
export async function requireAdminApi() {
  const cookieValue = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionSignature(cookieValue);
  if (!session) return null;

  const admin = await prisma.adminUser.findUnique({ where: { id: session.adminId } });
  // Same revocation check as requireAdmin. Kept in both rather than shared,
  // because the two differ in what they do about a failure — one redirects, one
  // returns null — and a single helper returning "who, if anyone" would have to
  // be unwrapped identically at both call sites anyway.
  if (!admin || admin.tokenVersion !== session.tokenVersion) return null;

  return admin;
}
