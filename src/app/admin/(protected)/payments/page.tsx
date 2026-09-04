import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PaymentBadge } from "@/components/payment/PaymentBadge";
import { PaymentScreenshot } from "@/components/admin/PaymentScreenshot";
import { prisma } from "@/lib/prisma";
import { getPaymentConfig } from "@/lib/site-config";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, formatFils, isPaymentStatus } from "@/lib/payment";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { isEarlyBirdActive } from "@/lib/pricing";
import { updatePaymentConfig, updatePaymentStatus } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Payments",
};

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Fils back to a plain dinar figure for the price inputs. */
function toJod(fils: number): string {
  return String(fils / 1000);
}

export default async function AdminPaymentsPage({
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

  // Counted and summed in the database over the whole table, not derived from
  // the rows on screen. The money collected is a fact about the competition;
  // searching for one team must not appear to change it.
  const [config, registrations, total, verifiedCount, awaitingCount, collected] = await Promise.all([
    getPaymentConfig(),
    prisma.registration.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.registration.count(),
    prisma.registration.count({ where: { paymentStatus: "VERIFIED" } }),
    prisma.registration.count({ where: { paymentStatus: "SUBMITTED" } }),
    prisma.registration.aggregate({
      _sum: { paymentAmountFils: true },
      where: { paymentStatus: "VERIFIED" },
    }),
  ]);

  const earlyBirdRunning = isEarlyBirdActive(config);
  const collectedFils = collected._sum.paymentAmountFils ?? 0;
  const filtering = Boolean(q || status);

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        subtitle={
          filtering
            ? `Showing ${registrations.length} of ${total} team${total === 1 ? "" : "s"}`
            : `${total} teams · ${verifiedCount} verified (${formatFils(collectedFils)} collected)${awaitingCount > 0 ? ` · ${awaitingCount} awaiting a check` : ""}`
        }
      />

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">Configuration</h2>
        <p className="mt-1 text-xs text-ras-gray dark:text-white/70">
          Teams see nothing on the payment stage until this is switched on <em>and</em> an alias is
          entered — a blank alias would send transfers nowhere.
        </p>

        <form action={updatePaymentConfig} className="mt-4 grid gap-4">
          <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
            <input type="checkbox" name="paymentEnabled" defaultChecked={config.paymentEnabled} />
            Show CliQ payment details to registered teams
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>CliQ alias or mobile number</label>
              <input name="cliqAlias" defaultValue={config.cliqAlias} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Identifier type</label>
              <select name="cliqAliasType" defaultValue={config.cliqAliasType} className={inputClass}>
                <option value="ALIAS">CliQ alias</option>
                <option value="MOBILE">Mobile number</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Account name</label>
              <input name="cliqAccountName" defaultValue={config.cliqAccountName} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bank</label>
              <input name="cliqBankName" defaultValue={config.cliqBankName} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Extra instructions (optional)</label>
            <textarea name="paymentNote" rows={3} defaultValue={config.paymentNote} className={inputClass} />
          </div>

          <fieldset className="rounded-md border border-ras-gray/25 p-4">
            <legend className="px-1 text-sm font-semibold text-ras-purple dark:text-white">
              Price per team
            </legend>
            <p className="text-xs text-ras-gray dark:text-white/70">
              One flat fee per team, in dinars, chosen by the tier the team picks when registering.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>IEEE RAS member</label>
                <input
                  name="priceRasMember"
                  inputMode="decimal"
                  defaultValue={toJod(config.priceRasMemberFils)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>IEEE member</label>
                <input
                  name="priceIeeeMember"
                  inputMode="decimal"
                  defaultValue={toJod(config.priceIeeeMemberFils)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Non-member</label>
                <input
                  name="priceNonMember"
                  inputMode="decimal"
                  defaultValue={toJod(config.priceNonMemberFils)}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-ras-gray/25 p-4">
            <legend className="px-1 text-sm font-semibold text-ras-purple dark:text-white">
              Early bird discount
            </legend>
            <p className="text-xs text-ras-gray dark:text-white/70">
              A percentage off every tier, which stops on its own once the cutoff passes — you do not
              have to remember to switch it off. Untick the box to end it sooner. Teams already
              registered keep the price they were quoted.
            </p>
            <p className="mt-2 text-xs font-semibold text-ras-purple dark:text-white">
              {earlyBirdRunning
                ? `Running now — ${config.earlyBirdPercent}% off until ${config.earlyBirdCutoff?.toLocaleString()}.`
                : "Not running."}
            </p>

            <label className="mt-3 flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
              <input type="checkbox" name="earlyBirdEnabled" defaultChecked={config.earlyBirdEnabled} />
              Early bird discount is on
            </label>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Discount (%)</label>
                <input
                  name="earlyBirdPercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={config.earlyBirdPercent}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Ends at</label>
                <input
                  name="earlyBirdCutoff"
                  type="datetime-local"
                  defaultValue={toLocalInputValue(config.earlyBirdCutoff)}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>

      <h2 className="mt-10 font-display text-lg font-bold text-ras-purple dark:text-white">
        Reconciliation
      </h2>
      <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
        What each team was quoted, what they say they sent, and their proof. Check the reported
        amount against the bank statement before marking anything verified.
      </p>

      <div className="mt-4">
        <AdminFilters q={q} status={status} basePath="/admin/payments" />
      </div>

      <div className="space-y-4">
        {registrations.length === 0 ? (
          <Card>
            {/* Two different empty lists, and they mean opposite things: nothing
                has been registered yet, or a filter is hiding everything. */}
            <p className="text-sm text-ras-gray dark:text-white/70">
              {filtering
                ? `No team here matches that filter. Clear it to see all ${total} teams.`
                : "No registrations yet."}
            </p>
          </Card>
        ) : null}

        {registrations.map((reg) => {
          // The one number worth flagging: a team that sent something other
          // than what they were quoted needs a human before anything is marked
          // verified. Only compared once both figures exist.
          const mismatch =
            reg.feeDueFils !== null &&
            reg.paymentAmountFils !== null &&
            reg.feeDueFils !== reg.paymentAmountFils;

          return (
            <Card key={reg.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-ras-purple dark:text-white">{reg.teamName}</p>
                  <p className="text-xs text-ras-gray dark:text-white/60">
                    {reg.submitterEmail} · {reg.createdAt.toLocaleDateString()}
                    {reg.resumeCode ? (
                      <>
                        {" · code "}
                        <span className="font-mono font-semibold">{reg.resumeCode}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <PaymentBadge status={reg.paymentStatus} />
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-ras-gray dark:text-white/60">Tier</dt>
                  <dd className="text-ras-gray dark:text-white/80">{reg.feeTier}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ras-gray dark:text-white/60">Quoted</dt>
                  <dd className="font-semibold text-ras-purple dark:text-white">
                    {reg.feeDueFils !== null ? formatFils(reg.feeDueFils) : "—"}
                    {reg.feeDiscountFils ? (
                      <span className="ml-1 font-normal text-ras-gray dark:text-white/50">
                        (early bird &minus;{formatFils(reg.feeDiscountFils)})
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ras-gray dark:text-white/60">Reported</dt>
                  <dd className={mismatch ? "font-bold text-accent" : "text-ras-gray dark:text-white/80"}>
                    {reg.paymentAmountFils !== null ? formatFils(reg.paymentAmountFils) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ras-gray dark:text-white/60">Reference</dt>
                  <dd className="font-mono text-ras-gray dark:text-white/80">
                    {reg.paymentReference ?? "—"}
                  </dd>
                </div>
                {/* Only for verified rows, since that is the only status the
                    column is ever written for. */}
                {reg.paymentStatus === "VERIFIED" ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ras-gray dark:text-white/60">Verified by</dt>
                    <dd className="text-ras-gray dark:text-white/80">
                      {reg.paymentVerifiedBy ? (
                        <span className="font-semibold">{reg.paymentVerifiedBy}</span>
                      ) : (
                        /* Verified before this column existed. Saying so beats an
                           em dash, which would read as "nobody" rather than as
                           "nobody wrote it down". */
                        <span className="italic text-ras-gray/70 dark:text-white/40">
                          not recorded
                        </span>
                      )}
                      {reg.paymentVerifiedAt
                        ? ` · ${reg.paymentVerifiedAt.toLocaleDateString()}`
                        : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {mismatch ? (
                <p role="alert" className="mt-2 text-xs font-semibold text-accent">
                  Reported amount does not match the quoted fee — check before verifying.
                </p>
              ) : null}

              {reg.paymentScreenshotUrl ? (
                /* Served through an admin-only route rather than linked at its
                   blob URL. A bank confirmation must not end up in browser
                   history as a public link that keeps working. The component
                   shows it in place, so checking a payment against the amount
                   and reference above it does not mean downloading anything. */
                <PaymentScreenshot
                  registrationId={reg.id}
                  teamName={reg.teamName}
                  reportedOn={reg.paymentSubmittedAt?.toLocaleDateString()}
                />
              ) : (
                <p className="mt-3 text-xs text-ras-gray dark:text-white/50">No screenshot uploaded.</p>
              )}

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
                  Save
                </Button>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
