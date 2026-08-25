"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateRegistrationStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) throw new Error("Missing registration id or status.");

  await prisma.registration.update({ where: { id }, data: { status } });

  revalidatePath("/admin/registrations");
}

// Payment state is deliberately not writable from here. It has exactly one
// writer — updatePaymentStatus in ../payments/actions.ts — so that refusing a
// payment can never be confused with cancelling a registration.
