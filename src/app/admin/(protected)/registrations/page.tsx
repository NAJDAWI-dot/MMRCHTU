import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updateRegistrationStatus } from "./actions";
import { PaymentBadge } from "@/components/payment/PaymentBadge";
import { DeleteRegistration } from "@/components/admin/DeleteRegistration";
import { RegistrationExport } from "@/components/admin/RegistrationExport";
import { formatFils, isPaymentStatus } from "@/lib/payment";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { MIN_EXPORT_TOKEN_LENGTH } from "@/lib/export-token";
import { REGISTRATION_STATUSES } from "@/lib/registration-status";

export const metadata: Metadata = {
  title: "Admin — Registrations",
};

// The same list the action validates against, so the dropdown cannot offer a
// value the write would then refuse.
const STATUS_OPTIONS = REGISTRATION_STATUSES;

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const q = searchParams?.q?.trim() || undefined;
  // Anything that is not a real payment status is dropped rather than passed to
  // the query, so a hand-edited URL narrows nothing instead of erroring.
  const status = isPaymentStatus(searchParams?.status) ? searchParams.status : undefined;

  const where = {
    ...(status ? { paymentStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { teamName: { contains: q, mode: "insensitive" as const } },
            { submitterEmail: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // The three counts are of the whole table, never of the filtered view: they
  // are the standing picture of the competition, and a search for one team
  // should not appear to change how many teams have paid.
  const [registrations, total, paid, awaiting] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: { members: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.registration.count(),
    prisma.registration.count({ where: { paymentStatus: "VERIFIED" } }),
    prisma.registration.count({ where: { paymentStatus: "SUBMITTED" } }),
  ]);

  const filtering = Boolean(q || status);

  return (
    <div>
      <AdminPageHeader
        title="Registrations"
        subtitle={
          filtering
            ? `Showing ${registrations.length} of ${total} team${total === 1 ? "" : "s"}`
            : `${total} teams registered · ${paid} paid${awaiting > 0 ? ` · ${awaiting} awaiting a payment check` : ""}`
        }
      />

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

      <div className="mt-6">
        <AdminFilters q={q} status={status} basePath="/admin/registrations" />
      </div>

      {registrations.length === 0 ? (
        /* Names the query back rather than showing a blank page, so it is clear
           the list is empty because of the filter and not because the data is. */
        <p className="rounded-lg border border-dashed border-ras-gray/25 p-6 text-sm text-ras-gray dark:border-white/15 dark:text-white/70">
          No team matches{" "}
          {q ? (
            <>
              &ldquo;<strong className="text-ras-purple dark:text-white">{q}</strong>&rdquo;
            </>
          ) : (
            "that filter"
          )}
          . Try a shorter search, or clear the filter to see all {total} teams.
        </p>
      ) : (
      <div className="space-y-4">
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
      )}
    </div>
  );
}
