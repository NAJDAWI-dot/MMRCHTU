"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireSection } from "@/lib/admin-access";
import { requireAdmin } from "@/lib/auth";
import { parseRoles, serializeRoles } from "@/lib/roles";

export interface AdminFormState {
  status: "idle" | "error";
  error?: string;
}

export async function createAdmin(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireSection("/admin/admins");

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

  const roles = serializeRoles(formData.getAll("roles").map(String));
  if (!roles) {
    return { status: "error", error: "Pick at least one role, or the account opens nothing but the dashboard." };
  }

  await prisma.adminUser.create({
    data: { username, passwordHash: await hashPassword(password), roles },
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
  // Your own sessions only, so any role may do it.
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
  await requireSection("/admin/admins");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing admin id.");

  const count = await prisma.adminUser.count();
  if (count <= 1) {
    throw new Error("Cannot delete the last remaining admin account.");
  }

  // Nor the last Master, for the same reason updateRoles refuses to demote it.
  const rows = await prisma.adminUser.findMany({ select: { id: true, roles: true } });
  const target = rows.find((row) => row.id === id);
  const otherMasters = rows.filter((row) => row.id !== id && parseRoles(row.roles).includes("MASTER"));
  if (target && parseRoles(target.roles).includes("MASTER") && otherMasters.length === 0) {
    redirect("/admin/admins?error=last-master");
  }

  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/admins");
}

/**
 * Sets which desks an account opens. Master only.
 *
 * Refuses to take Master away from the last account holding it: with no
 * Master left there is nobody who can open this screen to put it back.
 */
export async function updateRoles(formData: FormData) {
  const actor = await requireSection("/admin/admins");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing admin id.");
  const roles = serializeRoles(formData.getAll("roles").map(String));

  if (!parseRoles(roles).includes("MASTER")) {
    const masters = await prisma.adminUser.findMany({ select: { id: true, roles: true } });
    const others = masters.filter((row) => row.id !== id && parseRoles(row.roles).includes("MASTER"));
    if (others.length === 0) {
      redirect("/admin/admins?error=last-master");
    }
  }

  await prisma.adminUser.update({ where: { id }, data: { roles } });
  revalidatePath("/admin/admins");
  // Taking your own Master away should land you somewhere you can still open.
  if (id === actor.id && !parseRoles(roles).includes("MASTER")) redirect("/admin");
}
