"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removePhoto } from "@/lib/photo-storage";

export async function updateRegistrationStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) throw new Error("Missing registration id or status.");

  await prisma.registration.update({ where: { id }, data: { status } });

  revalidatePath("/admin/registrations");
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
  await requireAdmin();

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
}
