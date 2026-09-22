"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  isAmbassadorStatus,
  normaliseReferralCode,
  suggestReferralCode,
  validateAmbassador,
  type AmbassadorErrors,
} from "@/lib/referral";
import { requireSection } from "@/lib/admin-access";

export interface AmbassadorFormState {
  status: "idle" | "created" | "error";
  errors?: AmbassadorErrors;
  /** The code just created, so the form can say which one. */
  created?: string;
}

export async function createAmbassador(
  _prevState: AmbassadorFormState,
  formData: FormData,
): Promise<AmbassadorFormState> {
  await requireSection("/admin/ambassadors");

  const name = String(formData.get("name") ?? "").trim();
  const university = String(formData.get("university") ?? "").trim();
  const typed = normaliseReferralCode(String(formData.get("code") ?? ""));

  const errors = validateAmbassador({ name, university, code: typed });
  if (errors.name || errors.code) return { status: "error", errors };

  let code = typed;
  if (code) {
    const taken = await prisma.ambassador.findUnique({ where: { code }, select: { id: true } });
    if (taken) {
      return { status: "error", errors: { code: "Another ambassador already has that code." } };
    }
  } else {
    // A few tries is plenty: three random characters after the name give
    // thousands of options per first name.
    for (let attempt = 0; attempt < 8 && !code; attempt++) {
      const candidate = suggestReferralCode(name);
      const taken = await prisma.ambassador.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!taken) code = candidate;
    }
    if (!code) {
      return { status: "error", errors: { code: "Couldn't make a free code. Type one instead." } };
    }
  }

  await prisma.ambassador.create({ data: { name, university, code } });

  revalidatePath("/admin/ambassadors");
  return { status: "created", created: code };
}

export async function setAmbassadorStatus(formData: FormData) {
  await requireSection("/admin/ambassadors");

  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (!id || !isAmbassadorStatus(status)) throw new Error("Missing ambassador id or status.");

  await prisma.ambassador.update({ where: { id }, data: { status } });
  revalidatePath("/admin/ambassadors");
}

/**
 * Deletes the ambassador. Their registrations stay, keep the code they typed,
 * and stop counting for anyone (the foreign key is ON DELETE SET NULL).
 */
export async function deleteAmbassador(formData: FormData) {
  await requireSection("/admin/ambassadors");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing ambassador id.");

  await prisma.ambassador.delete({ where: { id } });
  revalidatePath("/admin/ambassadors");
  revalidatePath("/admin/registrations");
}
