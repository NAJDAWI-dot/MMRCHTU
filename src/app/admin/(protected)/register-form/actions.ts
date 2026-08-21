"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateFormConfig(formData: FormData) {
  await requireAdmin();

  const deadlineDateStr = String(formData.get("deadlineDate") ?? "");
  const deadlineDate = deadlineDateStr ? new Date(deadlineDateStr) : null;

  // Built once and used for both halves of the upsert, so the two can never
  // drift apart the way they would if a new field were added to only one.
  const fields = {
    deadlineText: String(formData.get("deadlineText") ?? ""),
    deadlineDate: deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null,
    feeInfoText: String(formData.get("feeInfoText") ?? ""),
    isOpen: formData.get("isOpen") === "on",
    paymentEnabled: formData.get("paymentEnabled") === "on",
    // Trimmed on the way in: an alias with a stray space is copied by every
    // visitor and rejected by every banking app.
    cliqAlias: String(formData.get("cliqAlias") ?? "").trim(),
    cliqAliasType: String(formData.get("cliqAliasType") ?? "ALIAS") === "MOBILE" ? "MOBILE" : "ALIAS",
    cliqBankName: String(formData.get("cliqBankName") ?? "").trim(),
    cliqAccountName: String(formData.get("cliqAccountName") ?? "").trim(),
    paymentNote: String(formData.get("paymentNote") ?? "").trim(),
  };

  await prisma.registerFormConfig.upsert({
    where: { id: "singleton" },
    update: fields,
    create: { id: "singleton", ...fields },
  });

  revalidatePath("/register");
  revalidatePath("/admin/register-form");
}
