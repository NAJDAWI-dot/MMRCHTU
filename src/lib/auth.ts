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
  iat: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export function signSession(adminId: string): string {
  const payload = base64url(JSON.stringify({ adminId, iat: Date.now() } satisfies SessionPayload));
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

  return admin;
}

/** API-route guard: verifies the session and loads the admin, returning null (never redirects) if invalid. */
export async function requireAdminApi() {
  const cookieValue = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionSignature(cookieValue);
  if (!session) return null;

  return prisma.adminUser.findUnique({ where: { id: session.adminId } });
}
