"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { removePhoto } from "@/lib/photo-storage";
import { parseRegistrationStatus } from "@/lib/registration-status";
import { requireSection } from "@/lib/admin-access";
import { planMembers, prunePresent, readTeamEdit, validateTeamEdit, type TeamEditErrors } from "@/lib/team-edit";

export async function updateRegistrationStatus(formData: FormData) {
  await requireSection("/admin/registrations");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing registration id.");

  // Checked against the list rather than written through. The value arrives
  // from a form field, so before this any string at all could be persisted —
  // and a status nothing recognises silently drops the team out of every count
  // and filter that switches on it, including the confirmed and waiting
  // broadcast lists, without ever looking like an error.
  const status = parseRegistrationStatus(formData.get("status"));
  if (!status) throw new Error("Unrecognised registration status.");

  await prisma.registration.update({ where: { id }, data: { status } });

  revalidatePath("/admin/registrations");
  // The day site lists confirmed teams, so confirming one on the morning puts
  // it on the start line without waiting for the page's timer.
  revalidatePath("/");
}

export type TeamEditState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; error: string; errors?: TeamEditErrors };

/**
 * Saves an admin's edit of a team: its details, and its members as the form
 * lists them. Members left out are removed, new rows are added, and whoever is
 * first becomes the team leader. All in one transaction, so a team is never
 * left half edited.
 *
 * The fee is not touched. It was quoted from the leader's IEEE status when the
 * team registered and is stored as a figure, so changing the members, or who
 * leads them, does not reprice a team that may already have paid.
 */
export async function updateTeam(_prev: TeamEditState, formData: FormData): Promise<TeamEditState> {
  await requireSection("/admin/registrations");

  const id = String(formData.get("id") ?? "");
  const registration = id
    ? await prisma.registration.findUnique({
        where: { id },
        select: { members: { select: { id: true } }, dayStatus: { select: { presentIds: true } } },
      })
    : null;
  if (!registration) return { status: "error", error: "That team no longer exists. Reload the page." };

  const edit = readTeamEdit(formData);
  const errors = validateTeamEdit(edit);
  if (Object.keys(errors).length) {
    return { status: "error", error: errors.members ?? "Check the highlighted fields.", errors };
  }

  const plan = planMembers(
    registration.members.map((m) => m.id),
    edit.members,
  );
  if (!plan) return { status: "error", error: "The member list changed while you were editing. Reload the page." };

  await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id },
      data: {
        teamName: edit.teamName,
        submitterEmail: edit.submitterEmail,
        technicalExperience: edit.technicalExperience,
        motivation: edit.motivation,
        memberCount: edit.members.length,
      },
    });
    if (plan.remove.length) {
      await tx.teamMember.deleteMany({ where: { id: { in: plan.remove }, registrationId: id } });
    }
    for (const { id: memberId, order, data } of plan.update) {
      await tx.teamMember.update({ where: { id: memberId }, data: { ...data, order } });
    }
    for (const { order, data } of plan.create) {
      await tx.teamMember.create({ data: { ...data, order, registrationId: id } });
    }
    // The check-in desk keeps the ids of members who turned up; a removed one
    // must not stay counted there.
    const present = registration.dayStatus?.presentIds ?? "";
    const pruned = prunePresent(present, plan.remove);
    if (pruned !== present) {
      await tx.teamDayStatus.update({ where: { registrationId: id }, data: { presentIds: pruned } });
    }
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  // Team names and members show on the day site and at the check-in desk.
  revalidatePath("/", "layout");
  return { status: "saved", at: Date.now() };
}

// Payment state is deliberately not writable from here. It has exactly one
// writer — updatePaymentStatus in ../payments/actions.ts — so that refusing a
// payment can never be confused with cancelling a registration.

/**
 * Erases a registration and everything it left behind.
 *
 * "Everything" is wider than the one row, because a registration scatters:
 *
 *  - its team members, which the database cascades away on its own;
 *  - the proof-of-payment screenshot in blob storage, which nothing else
 *    references and which would otherwise stay publicly fetchable at its URL
 *    forever, with no record left that it exists — a bank screenshot is the
 *    last thing that should outlive the record it belonged to;
 *  - any broadcast contacts imported from it, which are copies rather than
 *    references and so are invisible to a cascade;
 *  - the public registrations counter, which the create path increments.
 *
 * The file goes before the row, matching deleteAlbum in ../gallery/actions.ts
 * and for the same reason: the row is the only record of which file exists, so
 * dropping it first would strand the screenshot with nothing pointing at it.
 * A failed file delete is logged rather than fatal — refusing to remove
 * somebody's personal data because a storage call failed is the worse outcome,
 * and the log is what makes the leftover findable.
 */
export async function deleteRegistration(formData: FormData) {
  await requireSection("/admin/registrations");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing registration id.");

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { members: { select: { email: true } } },
  });
  // Already gone — most likely a double submit. Nothing to do, and nothing
  // worth showing an error for.
  if (!registration) return;

  if (registration.paymentScreenshotKey) {
    const result = await removePhoto(registration.paymentScreenshotKey);
    if (!result.ok) {
      console.error(
        `registrations: could not delete ${registration.paymentScreenshotKey}: ${result.error}`,
      );
    }
  }

  // Every address this registration put into the world, lower-cased to match
  // how the broadcast importer stores them.
  const emails = [
    registration.submitterEmail,
    ...registration.members.map((m) => m.email),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.registration.delete({ where: { id } });

    // Only now that the row is gone can we ask whether anyone else still
    // accounts for these addresses. A shared address — two teammates using one
    // inbox, a supervisor on several teams — must keep its place on the list.
    const stillUsed = new Set<string>();
    if (emails.length) {
      const survivors = await tx.registration.findMany({
        where: {
          OR: [
            { submitterEmail: { in: emails, mode: "insensitive" } },
            { members: { some: { email: { in: emails, mode: "insensitive" } } } },
          ],
        },
        select: { submitterEmail: true, members: { select: { email: true } } },
      });
      for (const s of survivors) {
        stillUsed.add(s.submitterEmail.trim().toLowerCase());
        for (const m of s.members) stillUsed.add(m.email.trim().toLowerCase());
      }
    }

    const orphaned = emails.filter((e) => !stillUsed.has(e));
    if (orphaned.length) {
      // Scoped to imported rows: anyone an admin typed in by hand stays, even
      // if they happen to share an address with a team being removed.
      await tx.broadcastContact.deleteMany({
        where: { email: { in: orphaned, mode: "insensitive" }, source: "REGISTRATION" },
      });
    }

    // Mirrors the increment in createRegistration. Floored at zero so a counter
    // that has drifted cannot be driven negative by tidying up.
    await tx.counter.updateMany({
      where: { key: "registrations", value: { gt: 0 } },
      data: { value: { decrement: 1 } },
    });
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  revalidatePath("/");
}
