"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
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
