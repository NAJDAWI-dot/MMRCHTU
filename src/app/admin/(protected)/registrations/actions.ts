"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaymentStatus } from "@/lib/payment";

export async function updateRegistrationStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) throw new Error("Missing registration id or status.");

  await prisma.registration.update({ where: { id }, data: { status } });

  revalidatePath("/admin/registrations");
}

/**
 * Records the outcome of matching a reported CliQ transfer against the account.
 *
 * Separate from `updateRegistrationStatus` on purpose: refusing a payment must
 * not cancel a registration, and confirming a team must not silently mark their
 * fee as received. The two are different facts about a team and are decided by
 * different evidence.
 */
export async function updatePaymentStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "");
  const note = String(formData.get("paymentNote") ?? "").trim();

  if (!id) throw new Error("Missing registration id.");
  if (!isPaymentStatus(paymentStatus)) {
    throw new Error(`Unknown payment status: ${paymentStatus}`);
  }

  await prisma.registration.update({
    where: { id },
    data: {
      paymentStatus,
      paymentNote: note || null,
      // Stamped only when money is actually confirmed received, and cleared if
      // a verification is later withdrawn — so the date never outlives the fact.
      paymentVerifiedAt: paymentStatus === "VERIFIED" ? new Date() : null,
    },
  });

  revalidatePath("/admin/registrations");
}
