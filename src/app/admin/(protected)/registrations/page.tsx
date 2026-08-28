import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updateRegistrationStatus } from "./actions";
import { PaymentBadge } from "@/components/payment/PaymentBadge";
import { DeleteRegistration } from "@/components/admin/DeleteRegistration";
import { RegistrationExport } from "@/components/admin/RegistrationExport";
import { formatFils } from "@/lib/payment";
import { MIN_EXPORT_TOKEN_LENGTH } from "@/lib/export-token";

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

      {/*
        Only whether a token is configured crosses to the browser, never the
        token itself — rendering the secret would put it in the page source of
        this screen and in every screenshot of it.
      */}
      <RegistrationExport
        feedConfigured={
          (process.env.REGISTRATIONS_EXPORT_TOKEN ?? "").trim().length >= MIN_EXPORT_TOKEN_LENGTH
        }
      />

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

            {/* Read-only here on purpose: payments are decided under Payments,
                where the quoted fee and the screenshot are side by side. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-ras-gray/20 p-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-ras-gray dark:text-white/60">
                Fee
              </span>
              <PaymentBadge status={reg.paymentStatus} />
              {reg.feeDueFils !== null ? (
                <span className="text-xs font-semibold text-ras-purple dark:text-white">
                  {formatFils(reg.feeDueFils)} due
                </span>
              ) : null}
              {reg.paymentReference ? (
                <span className="font-mono text-xs text-ras-gray dark:text-white/70">
                  {reg.paymentReference}
                </span>
              ) : null}
              <a
                href="/admin/payments"
                className="text-xs font-semibold text-ras-purple underline dark:text-white"
              >
                Manage in Payments
              </a>
            </div>

            <div className="mt-3 flex justify-end">
              <DeleteRegistration id={reg.id} teamName={reg.teamName} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
