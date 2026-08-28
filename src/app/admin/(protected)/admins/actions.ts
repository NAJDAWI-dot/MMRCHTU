"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export interface AdminFormState {
  status: "idle" | "error";
  error?: string;
}

export async function createAdmin(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || username.length < 3) {
    return { status: "error", error: "Username must be at least 3 characters." };
  }
  if (!password || password.length < 8) {
    return { status: "error", error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    return { status: "error", error: "That username is already taken." };
  }

  await prisma.adminUser.create({
    data: { username, passwordHash: await hashPassword(password) },
  });

  revalidatePath("/admin/admins");
  return { status: "idle" };
}

/**
 * Signs the current admin out of every device, including this one.
 *
 * The trigger for the revocation machinery in auth.ts. Sessions are stateless
 * signed tokens, so before this existed a cookie copied off a shared machine —
 * or left on a phone that was lost — stayed valid for its full seven days with
 * nothing anyone could do about it. Incrementing the version invalidates every
 * token carrying the old one, in one write.
 *
 * Scoped to the admin performing it rather than offered for any account,
 * because these accounts are peers with no roles between them: an "sign
 * everyone out" button would let any admin lock out the rest, which is a
 * different feature with a different set of questions attached to it.
 */
export async function signOutEverywhere() {
  const admin = await requireAdmin();

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { tokenVersion: { increment: 1 } },
  });

  // The cookie in this browser is now signed with a stale version, so it is
  // already refused; clearing it means the next page is the login form rather
  // than a redirect from a request that looked authenticated and was not.
  cookies().delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}

export async function deleteAdmin(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing admin id.");

  const count = await prisma.adminUser.count();
  if (count <= 1) {
    throw new Error("Cannot delete the last remaining admin account.");
  }

  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/admins");
}
