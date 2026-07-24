"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";

export interface LoginActionState {
  status: "idle" | "error";
  error?: string;
}

export async function loginAdmin(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { status: "error", error: "Enter a username and password." };
  }

  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { status: "error", error: "Incorrect username or password." };
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

  cookies().set(SESSION_COOKIE_NAME, signSession(admin.id), sessionCookieOptions());
  redirect("/admin");
}
