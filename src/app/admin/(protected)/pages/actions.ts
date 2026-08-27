"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManagedPage } from "@/lib/pages";

/**
 * Hides or un-hides one public page.
 *
 * The href is checked against MANAGED_PAGES rather than trusted: it arrives in
 * a form field, and an edited request could otherwise write a visibility row
 * for any path at all — "/" included, which would hide the homepage with no
 * switch anywhere to bring it back.
 */
export async function setPageHidden(formData: FormData) {
  await requireAdmin();

  const href = String(formData.get("href") ?? "");
  if (!isManagedPage(href)) {
    throw new Error(`Not a page whose visibility can be set: ${href}`);
  }

  const isHidden = String(formData.get("isHidden") ?? "") === "true";

  await prisma.pageVisibility.upsert({
    where: { href },
    update: { isHidden },
    create: { href, isHidden },
  });

  // The page itself, so a visitor sitting on a cached copy of a page just
  // hidden stops being served it.
  revalidatePath(href);
  revalidatePath("/admin/pages");
  // The site menu lives in the root layout, so the layout cache has to go too
  // or the link stays in the menu pointing at a 404.
  revalidatePath("/", "layout");
}
