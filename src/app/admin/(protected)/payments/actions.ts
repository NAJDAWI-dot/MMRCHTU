"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isPaymentStatus,
  parseAmountToFils,
  validatePaymentDecision,
  type PaymentStatus,
} from "@/lib/payment";
import type { ActionState } from "./state";

/**
 * A price typed in dinars, as fils.
 *
 * Falls back to the current stored value rather than zero when the box is
 * unreadable: a typo in one field should not quietly make a tier free.
 */
function priceOrFallback(raw: FormDataEntryValue | null, fallback: number): number {
  const parsed = parseAmountToFils(String(raw ?? ""));
  return parsed ?? fallback;
}

export async function updatePaymentConfig(formData: FormData) {
  await requireAdmin();

  const current = await prisma.paymentConfig.findUnique({ where: { id: "singleton" } });

  const cutoffStr = String(formData.get("earlyBirdCutoff") ?? "");
  const cutoff = cutoffStr ? new Date(cutoffStr) : null;

  const percentRaw = Number(formData.get("earlyBirdPercent") ?? 0);
  const percent = Number.isFinite(percentRaw) ? Math.min(Math.max(Math.round(percentRaw), 0), 100) : 0;

  // Built once and used for both halves of the upsert, so the two can never
  // drift apart the way they would if a new field were added to only one.
  const fields = {
    paymentEnabled: formData.get("paymentEnabled") === "on",
    // Trimmed on the way in: an alias with a stray space is copied by every
    // visitor and rejected by every banking app.
    cliqAlias: String(formData.get("cliqAlias") ?? "").trim(),
    cliqAliasType: String(formData.get("cliqAliasType") ?? "ALIAS") === "MOBILE" ? "MOBILE" : "ALIAS",
    cliqBankName: String(formData.get("cliqBankName") ?? "").trim(),
    cliqAccountName: String(formData.get("cliqAccountName") ?? "").trim(),
    paymentNote: String(formData.get("paymentNote") ?? "").trim(),
    priceRasMemberFils: priceOrFallback(formData.get("priceRasMember"), current?.priceRasMemberFils ?? 15_000),
    priceIeeeMemberFils: priceOrFallback(formData.get("priceIeeeMember"), current?.priceIeeeMemberFils ?? 25_000),
    priceNonMemberFils: priceOrFallback(formData.get("priceNonMember"), current?.priceNonMemberFils ?? 35_000),
    earlyBirdEnabled: formData.get("earlyBirdEnabled") === "on",
    earlyBirdPercent: percent,
    earlyBirdCutoff: cutoff && !Number.isNaN(cutoff.getTime()) ? cutoff : null,
  };

  await prisma.paymentConfig.upsert({
    where: { id: "singleton" },
    update: fields,
    create: { id: "singleton", ...fields },
  });

  revalidatePath("/register");
  revalidatePath("/admin/payments");
  // The discount badge rides on registration buttons in the site header and on
  // the homepage hero, and both of those are cached — the header by every page
  // that holds it, the homepage by its own revalidate window. Revalidating only
  // /register would switch the offer on at the one place that was already going
  // to be right, and leave the rest of the site advertising the old answer.
  // Same call, for the same reason, as the Pages and Gallery tabs make.
  revalidatePath("/", "layout");
}

/**
 * Records the outcome of matching a reported CliQ transfer against the account.
 *
 * Deliberately not folded into the registration-status action: refusing a
 * payment must not cancel a registration, and confirming a team on merit must
 * not silently mark their fee as received. Two different facts, decided by two
 * different kinds of evidence. Payment state has exactly one writer, and this
 * is it — the three exported actions below all go through `applyPaymentStatus`.
 */
type Admin = Awaited<ReturnType<typeof requireAdmin>>;

interface WriteOptions {
  /**
   * The note to store, or absent to leave whatever is there alone.
   *
   * The distinction matters: the one-click Verify button carries no note field,
   * and writing `null` for it would silently wipe a reconciliation note
   * somebody had already written on that row.
   */
  note?: string;
}

async function applyPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
  admin: Admin,
  options: WriteOptions = {},
): Promise<void> {
  const now = new Date();

  await prisma.registration.update({
    where: { id },
    data: {
      paymentStatus,
      ...(options.note !== undefined ? { paymentNote: options.note || null } : {}),
      // Stamped only when money is actually confirmed received, and cleared if
      // a verification is later withdrawn — so the date never outlives the fact.
      paymentVerifiedAt: paymentStatus === "VERIFIED" ? now : null,
      // Set and cleared on the same condition as the date above, so the two can
      // never disagree. A name left standing against a payment that is no
      // longer verified would be a claim nobody made.
      paymentVerifiedBy: paymentStatus === "VERIFIED" ? admin.username : null,
      // The other half of the record, and the half that survives: who touched
      // this payment last, whatever they set it to. Written unconditionally,
      // so refusing a payment or putting one back to unpaid leaves a trace the
      // verified-only columns above deliberately do not keep.
      paymentStatusBy: admin.username,
      paymentStatusAt: now,
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/review");
  revalidatePath("/admin/registrations");
}

/**
 * Where to go after a decision, if anywhere.
 *
 * `next` arrives in a form field, so it is attacker-controlled in principle and
 * an unchecked redirect target is an open redirect. Only ever back into the
 * payments area.
 */
function safeNext(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "");
  if (!value.startsWith("/admin/payments")) return null;
  return value;
}

function withParam(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

/**
 * The full status control on each row of the list.
 *
 * A `useFormState` handler, so a refusal to save can be shown on the row that
 * caused it rather than thrown as a server error over the whole page.
 */
export async function updatePaymentStatus(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "");
  const note = String(formData.get("paymentNote") ?? "").trim();

  if (!id) return { ok: false, message: "Missing registration id." };
  if (!isPaymentStatus(paymentStatus)) {
    return { ok: false, message: `Unknown payment status: ${paymentStatus}` };
  }

  const problem = validatePaymentDecision(paymentStatus, note);
  if (problem) return { ok: false, message: problem };

  await applyPaymentStatus(id, paymentStatus, admin, { note });
  return { ok: true, message: "Saved." };
}

/**
 * The one-click path: this matches, mark it paid.
 *
 * Verifying used to mean opening a dropdown, choosing, and pressing Save, for
 * every team in the list. This does the same write with one press, and
 * deliberately passes no note so an existing one survives.
 *
 * Shared with the review queue, which posts a `next` so each decision lands on
 * the following team instead of back where it started.
 */
export async function verifyPayment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing registration id.");

  await applyPaymentStatus(id, "VERIFIED", admin);

  const next = safeNext(formData.get("next"));
  if (next) redirect(next);
}

/**
 * Refusing a payment, which must say why.
 *
 * The team is shown this note on their own registration page, so a blank one
 * leaves them looking at a refusal with no explanation. The queue's textarea is
 * `required`, which handles it in the browser; this is the server-side half,
 * and it sends the admin back with a message rather than throwing.
 */
export async function rejectPayment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing registration id.");

  const note = String(formData.get("paymentNote") ?? "").trim();
  const next = safeNext(formData.get("next"));

  const problem = validatePaymentDecision("REJECTED", note);
  if (problem) {
    // A stable code rather than the message itself: the queue renders its own
    // copy, so nothing an admin sees on the page came out of the address bar.
    redirect(withParam(next ?? "/admin/payments/review", "error", "note-required"));
  }

  await applyPaymentStatus(id, "REJECTED", admin, { note });

  if (next) redirect(next);
}
