"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaymentStatus, parseAmountToFils } from "@/lib/payment";

/**
 * A price typed in dinars, as fils.
 *
 * Falls back to the current stored value rather than zero when the box is
 * unreadable: a typo in one field should not quietly make a tier free.
 */
function priceOrFallback(raw: FormDataEntryValue | null, fallback: number): number {
  const parsed = parseAmountToFils(String(raw ?? ""));
  return parsed ?? fallback;
}

export async function updatePaymentConfig(formData: FormData) {
  await requireAdmin();

  const current = await prisma.paymentConfig.findUnique({ where: { id: "singleton" } });

  const cutoffStr = String(formData.get("earlyBirdCutoff") ?? "");
  const cutoff = cutoffStr ? new Date(cutoffStr) : null;

  const percentRaw = Number(formData.get("earlyBirdPercent") ?? 0);
  const percent = Number.isFinite(percentRaw) ? Math.min(Math.max(Math.round(percentRaw), 0), 100) : 0;

  // Built once and used for both halves of the upsert, so the two can never
  // drift apart the way they would if a new field were added to only one.
  const fields = {
    paymentEnabled: formData.get("paymentEnabled") === "on",
    // Trimmed on the way in: an alias with a stray space is copied by every
    // visitor and rejected by every banking app.
    cliqAlias: String(formData.get("cliqAlias") ?? "").trim(),
    cliqAliasType: String(formData.get("cliqAliasType") ?? "ALIAS") === "MOBILE" ? "MOBILE" : "ALIAS",
    cliqBankName: String(formData.get("cliqBankName") ?? "").trim(),
    cliqAccountName: String(formData.get("cliqAccountName") ?? "").trim(),
    paymentNote: String(formData.get("paymentNote") ?? "").trim(),
    priceRasMemberFils: priceOrFallback(formData.get("priceRasMember"), current?.priceRasMemberFils ?? 15_000),
    priceIeeeMemberFils: priceOrFallback(formData.get("priceIeeeMember"), current?.priceIeeeMemberFils ?? 25_000),
    priceNonMemberFils: priceOrFallback(formData.get("priceNonMember"), current?.priceNonMemberFils ?? 35_000),
    earlyBirdEnabled: formData.get("earlyBirdEnabled") === "on",
    earlyBirdPercent: percent,
    earlyBirdCutoff: cutoff && !Number.isNaN(cutoff.getTime()) ? cutoff : null,
  };

  await prisma.paymentConfig.upsert({
    where: { id: "singleton" },
    update: fields,
    create: { id: "singleton", ...fields },
  });

  revalidatePath("/register");
  revalidatePath("/admin/payments");
  // The discount badge rides on registration buttons in the site header and on
  // the homepage hero, and both of those are cached — the header by every page
  // that holds it, the homepage by its own revalidate window. Revalidating only
  // /register would switch the offer on at the one place that was already going
  // to be right, and leave the rest of the site advertising the old answer.
  // Same call, for the same reason, as the Pages and Gallery tabs make.
  revalidatePath("/", "layout");
}

/**
 * Records the outcome of matching a reported CliQ transfer against the account.
 *
 * Deliberately not folded into the registration-status action: refusing a
 * payment must not cancel a registration, and confirming a team on merit must
 * not silently mark their fee as received. Two different facts, decided by two
 * different kinds of evidence. Payment state has exactly one writer, and this
 * is it.
 */
export async function updatePaymentStatus(formData: FormData) {
  // Kept, where this used to discard it. requireAdmin has already redirected an
  // invalid session by the time it returns, so this is always a real account.
  const admin = await requireAdmin();

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
      // Set and cleared on the same condition as the date above, so the two can
      // never disagree. A name left standing against a payment that is no
      // longer verified would be a claim nobody made.
      paymentVerifiedBy: paymentStatus === "VERIFIED" ? admin.username : null,
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/registrations");
}
