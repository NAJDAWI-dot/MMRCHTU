"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromAmmanDateTimeLocal } from "@/lib/open-day";

/**
 * Saving the open day.
 *
 * The two dates are read as Amman time rather than as the server's, which is
 * UTC on Vercel. An admin sitting in Amman types the hour the stand opens and
 * that is the hour it opens.
 */
export async function updateOpenDay(formData: FormData) {
  await requireAdmin();

  const data = {
    enabled: formData.get("enabled") === "on",
    showOnHome: formData.get("showOnHome") === "on",
    lockUntilOpen: formData.get("lockUntilOpen") === "on",
    startsAt: fromAmmanDateTimeLocal(String(formData.get("startsAt") ?? "")),
    endsAt: fromAmmanDateTimeLocal(String(formData.get("endsAt") ?? "")),
    // Trimmed and capped: this goes on the homepage of the site, and a venue
    // is a line, not an essay.
    location: String(formData.get("location") ?? "").trim().slice(0, 120),
  };

  await prisma.openDayConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  // The stand page reads the row directly. The homepage is revalidated every
  // five minutes, which is four and a half minutes too long to wait to see
  // whether the thing you just saved looks right.
  revalidatePath("/open-day");
  revalidatePath("/");
  revalidatePath("/admin/open-day");
  // The lock decides whether Open Day is in the site menu, and the menu lives
  // in the root layout, so the layout cache has to go with it.
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
}
