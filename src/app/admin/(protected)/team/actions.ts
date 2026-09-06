"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removePhoto, storePhoto } from "@/lib/photo-storage";
import { SNIFF_BYTES, checkUpload, sniffImageType } from "@/lib/gallery";
import { parseCommitteeRank, portraitStorageKey } from "@/lib/roster";

/**
 * Everything the Team tab writes.
 *
 * Portraits go through the same storage rules as gallery photos — the bytes
 * are sniffed, the key is built from the verified type, and nothing from the
 * uploaded filename survives. Two upload paths reaching the same store under
 * different rules is how the safer one quietly becomes the way in, so this one
 * borrows the gallery's helpers rather than writing its own.
 */

function revalidateTeam() {
  revalidatePath("/team");
  revalidatePath("/admin/team");
  // The header hides the Team link while nobody is published.
  revalidatePath("/", "layout");
}

function numberOr(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

/* -------------------------------------------------------------------------- */
/* Departments                                                                 */
/* -------------------------------------------------------------------------- */

export async function createDepartment(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A department needs a name.");

  await prisma.committeeDepartment.create({
    data: {
      name,
      description: String(formData.get("description") ?? "").trim(),
      sortOrder: numberOr(formData.get("sortOrder"), 0),
    },
  });

  revalidateTeam();
}

export async function updateDepartment(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Missing department id or name.");

  await prisma.committeeDepartment.update({
    where: { id },
    data: {
      name,
      description: String(formData.get("description") ?? "").trim(),
      sortOrder: numberOr(formData.get("sortOrder"), 0),
    },
  });

  revalidateTeam();
}

/**
 * Removes a department without removing its people.
 *
 * The foreign key is ON DELETE SET NULL, so everybody in it reappears under
 * "not in a department" on both this tab and the public page. Deleting a
 * department is a reorganisation, and losing half the committee to one is not
 * a surprise anybody should be able to trigger with one button.
 */
export async function deleteDepartment(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing department id.");

  await prisma.committeeDepartment.delete({ where: { id } });

  revalidateTeam();
}

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

/** The department to store, or null — an empty select means "none". */
function departmentOrNull(value: FormDataEntryValue | null): string | null {
  const id = String(value ?? "").trim();
  return id || null;
}

export async function createMember(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A member needs a name.");

  await prisma.committeeMember.create({
    data: {
      name,
      role: String(formData.get("role") ?? "").trim(),
      rank: parseCommitteeRank(formData.get("rank")),
      departmentId: departmentOrNull(formData.get("departmentId")),
      sortOrder: numberOr(formData.get("sortOrder"), 0),
    },
  });

  revalidateTeam();
}

export async function updateMember(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Missing member id or name.");

  await prisma.committeeMember.update({
    where: { id },
    data: {
      name,
      role: String(formData.get("role") ?? "").trim(),
      rank: parseCommitteeRank(formData.get("rank")),
      departmentId: departmentOrNull(formData.get("departmentId")),
      sortOrder: numberOr(formData.get("sortOrder"), 0),
      isPublished: formData.get("isPublished") === "on",
    },
  });

  revalidateTeam();
}

export async function deleteMember(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing member id.");

  const member = await prisma.committeeMember.findUnique({ where: { id } });
  if (!member) return;

  // File first: the row is the only record that the file exists, so removing
  // it first would strand the portrait in the store with nothing pointing at
  // it. A failed file delete is logged, never fatal.
  if (member.photoKey) {
    const result = await removePhoto(member.photoKey);
    if (!result.ok) console.error(`team: could not delete ${member.photoKey}: ${result.error}`);
  }

  await prisma.committeeMember.delete({ where: { id } });

  revalidateTeam();
}

/* -------------------------------------------------------------------------- */
/* Portraits                                                                   */
/* -------------------------------------------------------------------------- */

export interface PortraitResult {
  ok: boolean;
  error?: string;
}

/**
 * Replaces one member's portrait.
 *
 * The new file is stored before the old one is deleted. The other order would
 * mean a failed upload leaves the member with no picture at all, having had a
 * perfectly good one a moment earlier.
 */
export async function uploadMemberPhoto(formData: FormData): Promise<PortraitResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing member id." };

  const file = formData.get("photo");
  if (!(file instanceof File)) return { ok: false, error: "No file was selected." };

  const member = await prisma.committeeMember.findUnique({ where: { id } });
  if (!member) return { ok: false, error: "That member no longer exists." };

  const problem = checkUpload({ name: file.name, type: file.type, size: file.size });
  if (problem) return { ok: false, error: problem };

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const imageType = sniffImageType(head);
  if (!imageType) return { ok: false, error: "That is not a JPEG, PNG, WebP or AVIF image." };

  try {
    const unique = Date.now().toString(36);
    const key = portraitStorageKey(member.name, imageType, unique);
    const stored = await storePhoto(key, file, imageType);

    const previousKey = member.photoKey;

    await prisma.committeeMember.update({
      where: { id },
      data: { photoUrl: stored.url, photoKey: stored.key },
    });

    // Only once the row points at the new file. Keys differ every time, so
    // this cannot delete the picture that was just stored.
    if (previousKey && previousKey !== stored.key) {
      const removed = await removePhoto(previousKey);
      if (!removed.ok) console.error(`team: could not delete ${previousKey}: ${removed.error}`);
    }

    revalidateTeam();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function removeMemberPhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing member id.");

  const member = await prisma.committeeMember.findUnique({ where: { id } });
  if (!member) return;

  if (member.photoKey) {
    const result = await removePhoto(member.photoKey);
    if (!result.ok) console.error(`team: could not delete ${member.photoKey}: ${result.error}`);
  }

  await prisma.committeeMember.update({
    where: { id },
    data: { photoUrl: null, photoKey: null },
  });

  revalidateTeam();
}
