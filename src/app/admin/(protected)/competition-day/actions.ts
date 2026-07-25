"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseStatus } from "@/lib/competition-day";

export async function updateCompetitionDay(formData: FormData) {
  await requireAdmin();

  const data = {
    status: parseStatus(formData.get("status")),
    headline: String(formData.get("headline") ?? "").trim() || "Competition Day",
    intro: String(formData.get("intro") ?? "").trim(),
    comingSoonText:
      String(formData.get("comingSoonText") ?? "").trim() || "Details will be released as soon as possible.",
    dateText: String(formData.get("dateText") ?? "").trim(),
    venue: String(formData.get("venue") ?? "").trim(),
    details: String(formData.get("details") ?? "").trim(),
  };

  await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/competition-day");
  revalidatePath("/admin/competition-day");
  // The site menu shows or hides the Competition Day link based on this status,
  // and the menu lives in the root layout — so the layout cache has to go too.
  revalidatePath("/", "layout");
}
