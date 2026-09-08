"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removePhoto, storePhoto } from "@/lib/photo-storage";
import {
  SNIFF_BYTES,
  checkUpload,
  sniffImageType,
  type AllowedImageType,
} from "@/lib/gallery";
import { parseCommitteeRank, portraitStorageKey, stageStorageKey } from "@/lib/roster";

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
      tribute: String(formData.get("tribute") ?? "").trim(),
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
      tribute: String(formData.get("tribute") ?? "").trim(),
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

  // Files first: the row is the only record that either file exists, so
  // removing it first would strand them in the store with nothing pointing at
  // them. A failed file delete is logged, never fatal.
  for (const key of [member.photoKey, member.stageKey]) {
    if (!key) continue;
    const result = await removePhoto(key);
    if (!result.ok) console.error(`team: could not delete ${key}: ${result.error}`);
  }

  await prisma.committeeMember.delete({ where: { id } });

  revalidateTeam();
}

/* -------------------------------------------------------------------------- */
/* Pictures                                                                    */
/* -------------------------------------------------------------------------- */

export interface PortraitResult {
  ok: boolean;
  error?: string;
}

/** The two pictures a committee member can have. */
type ImageSlot = "portrait" | "stage";

interface SlotRules {
  storageKey(name: string, imageType: AllowedImageType, unique: string): string;
  keyOf(member: { photoKey: string | null; stageKey: string | null }): string | null;
  columns(url: string | null, key: string | null): Record<string, string | null>;
}

const SLOT: Record<ImageSlot, SlotRules> = {
  portrait: {
    storageKey: portraitStorageKey,
    keyOf: (member) => member.photoKey,
    columns: (url, key) => ({ photoUrl: url, photoKey: key }),
  },
  stage: {
    storageKey: stageStorageKey,
    keyOf: (member) => member.stageKey,
    columns: (url, key) => ({ stageUrl: url, stageKey: key }),
  },
};

/**
 * Replaces one of a member's pictures.
 *
 * One body for both slots on purpose. Two upload paths reaching the same store
 * under separately maintained rules is how the safer one quietly stops being
 * the way in — so the sniffing, the size check and the store-then-delete order
 * are written once and the slot only decides which key to build and which two
 * columns to write.
 *
 * The new file is stored before the old one is deleted. The other order would
 * mean a failed upload leaves the member with no picture at all, having had a
 * perfectly good one a moment earlier.
 */
async function replaceMemberImage(slot: ImageSlot, formData: FormData): Promise<PortraitResult> {
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

  const rules = SLOT[slot];

  try {
    const unique = Date.now().toString(36);
    const key = rules.storageKey(member.name, imageType, unique);
    const stored = await storePhoto(key, file, imageType);

    const previousKey = rules.keyOf(member);

    await prisma.committeeMember.update({
      where: { id },
      data: rules.columns(stored.url, stored.key),
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

async function clearMemberImage(slot: ImageSlot, formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing member id.");

  const member = await prisma.committeeMember.findUnique({ where: { id } });
  if (!member) return;

  const rules = SLOT[slot];
  const key = rules.keyOf(member);

  if (key) {
    const result = await removePhoto(key);
    if (!result.ok) console.error(`team: could not delete ${key}: ${result.error}`);
  }

  await prisma.committeeMember.update({ where: { id }, data: rules.columns(null, null) });

  revalidateTeam();
}

export async function uploadMemberPhoto(formData: FormData): Promise<PortraitResult> {
  return replaceMemberImage("portrait", formData);
}

export async function removeMemberPhoto(formData: FormData): Promise<void> {
  return clearMemberImage("portrait", formData);
}

/**
 * The backdrop this person's tribute is shown against.
 *
 * Optional in a way the portrait is not: with no stage uploaded the popup
 * composes one from their id, so leaving this empty is a legitimate finished
 * state rather than a gap to be filled in later.
 */
export async function uploadMemberStage(formData: FormData): Promise<PortraitResult> {
  return replaceMemberImage("stage", formData);
}

export async function removeMemberStage(formData: FormData): Promise<void> {
  return clearMemberImage("stage", formData);
}
