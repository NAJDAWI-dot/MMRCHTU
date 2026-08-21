import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updatePaymentStatus, updateRegistrationStatus } from "./actions";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  formatFils,
  isPaymentStatus,
} from "@/lib/payment";

export const metadata: Metadata = {
  title: "Admin — Registrations",
};

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "WAITLISTED", "CANCELLED"];

export default async function AdminRegistrationsPage() {
  const registrations = await prisma.registration.findMany({
    include: { members: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  // Surfaced up front because it is the number the committee chases.
  const awaiting = registrations.filter((r) => r.paymentStatus === "SUBMITTED").length;
  const paid = registrations.filter((r) => r.paymentStatus === "VERIFIED").length;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Registrations</h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        {registrations.length} teams registered · {paid} paid
        {awaiting > 0 ? ` · ${awaiting} awaiting a payment check` : ""}
      </p>

      <div className="mt-6 space-y-4">
        {registrations.map((reg) => (
          <Card key={reg.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display font-bold text-ras-purple dark:text-white">{reg.teamName}</p>
                <p className="text-xs text-ras-gray dark:text-white/60">
                  {reg.submitterEmail} · {reg.memberCount} member{reg.memberCount > 1 ? "s" : ""} ·{" "}
                  {reg.createdAt.toLocaleDateString()}
                </p>
              </div>
              <form action={updateRegistrationStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={reg.id} />
                <select
                  name="status"
                  defaultValue={reg.status}
                  className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  Update
                </Button>
              </form>
            </div>

            <ul className="mt-3 space-y-1 text-sm text-ras-gray dark:text-white/80">
              {reg.members.map((m) => (
                <li key={m.id}>
                  {m.order === 1 ? "Team Leader" : `Member ${m.order}`}: {m.firstName} {m.lastName} — {m.university},{" "}
                  {m.major} — {m.ieeeStatus} ({m.ieeeMembershipId}) — {m.email} / {m.whatsapp}
                </li>
              ))}
            </ul>

            <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
              <strong>Experience:</strong> {reg.technicalExperience}
            </p>
            <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
              <strong>Motivation:</strong> {reg.motivation}
            </p>

            <div className="mt-4 rounded-md border border-ras-gray/20 p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-ras-gray dark:text-white/60">
                  Fee
                </span>
                <PaymentBadge status={reg.paymentStatus} />
                {reg.paymentReference ? (
                  <span className="font-mono text-xs text-ras-gray dark:text-white/70">
                    {reg.paymentReference}
                  </span>
                ) : null}
                {reg.paymentAmountFils ? (
                  <span className="text-xs font-semibold text-ras-purple dark:text-white">
                    {formatFils(reg.paymentAmountFils)}
                  </span>
                ) : null}
                {reg.paymentSubmittedAt ? (
                  <span className="text-xs text-ras-gray dark:text-white/50">
                    reported {reg.paymentSubmittedAt.toLocaleDateString()}
                  </span>
                ) : null}
              </div>

              {reg.paymentNote ? (
                <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
                  <strong>Note:</strong> {reg.paymentNote}
                </p>
              ) : null}

              <form action={updatePaymentStatus} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={reg.id} />
                <select
                  name="paymentStatus"
                  defaultValue={reg.paymentStatus}
                  aria-label={`Payment status for ${reg.teamName}`}
                  className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  name="paymentNote"
                  defaultValue={reg.paymentNote ?? ""}
                  placeholder="Note (e.g. why it did not match)"
                  aria-label={`Payment note for ${reg.teamName}`}
                  className="min-w-0 flex-1 rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                />
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  Save fee
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Colour carries the same meaning as the words, never instead of them. */
function PaymentBadge({ status }: { status: string }) {
  const known = isPaymentStatus(status) ? status : "UNPAID";
  const tone =
    known === "VERIFIED"
      ? "bg-ras-purple/15 text-ras-purple dark:bg-white/15 dark:text-white"
      : known === "SUBMITTED"
        ? "bg-[#F2A900]/20 text-[#8a6200] dark:text-[#F2A900]"
        : known === "REJECTED"
          ? "bg-ras-crimson/15 text-ras-crimson dark:text-rose-300"
          : "bg-ras-gray/15 text-ras-gray dark:text-white/60";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {PAYMENT_STATUS_LABELS[known]}
    </span>
  );
}
