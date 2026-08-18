"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBroadcast } from "@/lib/email";
import { KIND_IMPORT_STATUS, parseContactInput, parseListKind, type BroadcastListKind } from "@/lib/broadcast";

// Actions that report a result back to the admin are `useFormState` handlers
// returning ActionState (defined in ./state, which this file may not export —
// see the note there). An earlier version passed feedback via a `?notice=`
// query param, but redirecting to the same pathname with only the search string
// changed does not re-render the page, so the admin kept seeing the previous
// action's message with no way to tell whether their change applied.
import type { ActionState } from "./state";

/**
 * Adds contacts to a list, skipping addresses already on it.
 *
 * Reads the existing addresses and filters them out before writing. Postgres
 * would also support `createMany({ skipDuplicates })`, but filtering here is
 * what lets the action report an accurate added/skipped count back to the
 * admin. The @@unique([listId, email]) constraint remains the real guard —
 * this only avoids the write throwing on the common "re-paste an overlapping
 * batch" path.
 */
async function addUniqueContacts(
  listId: string,
  candidates: { email: string; name: string }[],
  source: "MANUAL" | "REGISTRATION",
): Promise<{ added: number; skipped: number }> {
  const existing = await prisma.broadcastContact.findMany({
    where: { listId },
    select: { email: true },
  });
  const seen = new Set(existing.map((c) => c.email));
  const fresh = candidates.filter((c) => !seen.has(c.email));

  if (fresh.length) {
    await prisma.broadcastContact.createMany({
      data: fresh.map((c) => ({ listId, email: c.email, name: c.name, source })),
    });
  }

  return { added: fresh.length, skipped: candidates.length - fresh.length };
}

export async function createBroadcastList(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("List name is required.");

  const kind: BroadcastListKind = parseListKind(formData.get("kind"));
  const description = String(formData.get("description") ?? "").trim();

  const list = await prisma.broadcastList.create({ data: { name, kind, description } });

  revalidatePath("/admin/broadcasts");
  // A genuine navigation to a different route, so a plain redirect is correct
  // here — the new list's own page is the confirmation.
  redirect(`/admin/broadcasts/${list.id}`);
}

export async function deleteBroadcastList(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing list id.");

  // Contacts and broadcasts cascade (see schema.prisma relations).
  await prisma.broadcastList.delete({ where: { id } });

  revalidatePath("/admin/broadcasts");
  redirect("/admin/broadcasts");
}

export async function addContacts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const listId = String(formData.get("listId") ?? "");
  if (!listId) return { message: "Missing list id.", ok: false };

  const { contacts, invalid } = parseContactInput(String(formData.get("people") ?? ""));

  if (!contacts.length) {
    return {
      message: invalid.length
        ? `No valid email addresses found. Skipped: ${invalid.join(", ")}`
        : "No email addresses entered.",
      ok: false,
    };
  }

  const { added, skipped } = await addUniqueContacts(listId, contacts, "MANUAL");

  const parts = [`Added ${added} contact${added === 1 ? "" : "s"}.`];
  if (skipped > 0) parts.push(`${skipped} already on the list.`);
  if (invalid.length) parts.push(`Skipped invalid: ${invalid.join(", ")}`);

  revalidatePath(`/admin/broadcasts/${listId}`);
  return { message: parts.join(" "), ok: added > 0 };
}

export async function removeContact(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!id) throw new Error("Missing contact id.");

  await prisma.broadcastContact.delete({ where: { id } });

  revalidatePath(`/admin/broadcasts/${listId}`);
}

/**
 * Pulls every team member of registrations whose status matches the list's
 * kind (CONFIRMED -> "CONFIRMED", WAITING -> "WAITLISTED"). Re-runnable: existing
 * rows are skipped, so this tops a list up after new teams are confirmed
 * without disturbing hand-added contacts.
 */
export async function importFromRegistrations(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const listId = String(formData.get("listId") ?? "");
  if (!listId) return { message: "Missing list id.", ok: false };

  const list = await prisma.broadcastList.findUnique({ where: { id: listId } });
  if (!list) return { message: "List not found.", ok: false };

  const status = KIND_IMPORT_STATUS[parseListKind(list.kind)];
  if (!status) {
    return { message: "Custom lists have no registration status to import from — add people manually.", ok: false };
  }

  const registrations = await prisma.registration.findMany({
    where: { status },
    include: { members: { orderBy: { order: "asc" } } },
  });

  const byEmail = new Map<string, { email: string; name: string }>();
  for (const reg of registrations) {
    for (const m of reg.members) {
      const email = m.email.trim().toLowerCase();
      if (email && !byEmail.has(email)) {
        byEmail.set(email, { email, name: `${m.firstName} ${m.lastName}`.trim() });
      }
    }
    // Teams registered before the member form existed (or with a submitter who
    // isn't listed as a member) would otherwise be missed entirely.
    const submitter = reg.submitterEmail.trim().toLowerCase();
    if (submitter && !byEmail.has(submitter)) {
      byEmail.set(submitter, { email: submitter, name: reg.teamName });
    }
  }

  const candidates = [...byEmail.values()];
  if (!candidates.length) {
    return { message: `No registrations with status ${status} to import.`, ok: false };
  }

  const { added, skipped } = await addUniqueContacts(listId, candidates, "REGISTRATION");

  revalidatePath(`/admin/broadcasts/${listId}`);
  return {
    message: `Imported ${added} new contact${added === 1 ? "" : "s"} from ${registrations.length} ${status} registration${registrations.length === 1 ? "" : "s"}. ${skipped} already on the list.`,
    ok: added > 0,
  };
}

export async function sendBroadcastToList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const listId = String(formData.get("listId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!listId) return { message: "Missing list id.", ok: false };
  if (!subject || !body) {
    return { message: "Subject and message are both required to send a broadcast.", ok: false };
  }

  const contacts = await prisma.broadcastContact.findMany({ where: { listId }, orderBy: { addedAt: "asc" } });
  if (!contacts.length) {
    return { message: "This list has no contacts yet — nothing was sent.", ok: false };
  }

  const result = await sendBroadcast(
    contacts.map((c) => ({ email: c.email, name: c.name })),
    subject,
    body,
  );

  await prisma.broadcast.create({
    data: { listId, subject, body, sentCount: result.sent, failedCount: result.failed },
  });

  revalidatePath(`/admin/broadcasts/${listId}`);
  return {
    message: result.failed
      ? `Sent to ${result.sent} of ${contacts.length}. Failed: ${result.failedEmails.join(", ")}`
      : `Sent "${subject}" to all ${result.sent} contact${result.sent === 1 ? "" : "s"}.`,
    ok: result.failed === 0,
  };
}
