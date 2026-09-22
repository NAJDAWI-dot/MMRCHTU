"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REFERENCE_NOTE_MAX,
  REFERENCE_TITLE_MAX,
  parseKind,
  parseReferenceUrl,
} from "@/lib/references";
import type { ActionState } from "./state";

/**
 * The reading list, edited.
 *
 * Every write clears the guide as well as this screen. The public page reads
 * its references from the database but is cached, so without the first line an
 * admin adds a link, looks at the page, sees nothing and adds it again.
 */
function refreshed() {
  revalidatePath("/micromouse");
  revalidatePath("/admin/micromouse");
}

/**
 * What the form gave us, or what is wrong with it.
 *
 * A message rather than a thrown error, because both things this rejects are
 * ordinary typing mistakes: a link pasted from the wrong clipboard entry, or a
 * title nobody filled in. A throw inside a server action reaches the admin as
 * a blank error screen with no way back to the form they were filling in.
 */
function fields(formData: FormData): { data: ReferenceInput } | { error: string } {
  const url = parseReferenceUrl(formData.get("url") as string);
  if (!url) {
    return { error: "That does not look like a link. It needs to start with http:// or https://." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give it a title, so the card has something to say." };

  return {
    data: {
      kind: parseKind(formData.get("kind") as string),
      title: title.slice(0, REFERENCE_TITLE_MAX),
      url,
      author: String(formData.get("author") ?? "")
        .trim()
        .slice(0, REFERENCE_TITLE_MAX),
      note: String(formData.get("note") ?? "")
        .trim()
        .slice(0, REFERENCE_NOTE_MAX),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
      // An unchecked box sends nothing at all, which is how a box nobody ever
      // ticks ends up meaning "published" if you read it the other way round.
      isPublished: formData.get("isPublished") === "on",
    },
  };
}

interface ReferenceInput {
  kind: string;
  title: string;
  url: string;
  author: string;
  note: string;
  sortOrder: number;
  isPublished: boolean;
}

export async function createReference(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = fields(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  await prisma.micromouseReference.create({ data: parsed.data });
  refreshed();
  return { ok: true, message: `Added “${parsed.data.title}”.` };
}

export async function updateReference(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "That row has lost its id. Reload the page and try again." };

  const parsed = fields(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  await prisma.micromouseReference.update({ where: { id }, data: parsed.data });
  refreshed();
  return { ok: true, message: "Saved." };
}

/** No validation to fail: either the row is there or somebody else deleted it. */
export async function deleteReference(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing reference id.");

  await prisma.micromouseReference.delete({ where: { id } });
  refreshed();
}
