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
  };

  await prisma.registerFormConfig.upsert({
    where: { id: "singleton" },
    update: fields,
    create: { id: "singleton", ...fields },
  });

  revalidatePath("/register");
  revalidatePath("/admin/register-form");
}
