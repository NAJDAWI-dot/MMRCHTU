"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateFormConfig(formData: FormData) {
  await requireAdmin();

  const deadlineDateStr = String(formData.get("deadlineDate") ?? "");
  const deadlineDate = deadlineDateStr ? new Date(deadlineDateStr) : null;

  await prisma.registerFormConfig.upsert({
    where: { id: "singleton" },
    update: {
      deadlineText: String(formData.get("deadlineText") ?? ""),
      deadlineDate: deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null,
      feeInfoText: String(formData.get("feeInfoText") ?? ""),
      isOpen: formData.get("isOpen") === "on",
    },
    create: {
      id: "singleton",
      deadlineText: String(formData.get("deadlineText") ?? ""),
      deadlineDate: deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null,
      feeInfoText: String(formData.get("feeInfoText") ?? ""),
      isOpen: formData.get("isOpen") === "on",
    },
  });

  revalidatePath("/register");
  revalidatePath("/admin/register-form");
}
