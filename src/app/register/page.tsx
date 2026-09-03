import type { Metadata } from "next";
import { RegisterForm } from "@/app/register/RegisterForm";
import { PaymentBadge } from "@/components/payment/PaymentBadge";
import { getRegisterFormConfig } from "@/lib/site-config";
import { PAYMENT_STATUS_BLURB, formatFils, isPaymentStatus } from "@/lib/payment";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";
import { normaliseResumeCode } from "@/lib/registration-code";
import { prisma } from "@/lib/prisma";

// A status lookup reads one registration row, so this cannot be cached
// wholesale. Without a code it is only configuration.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register",
  description: "Register your team for MMRC 26.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  // Payment configuration is not read here on purpose. It reaches the form with
  // the response to Next, so that step one's page source says nothing about how
  // to pay.
  const config = await getRegisterFormConfig();

  // Someone checking on a registration they already completed. Resolved here
  // rather than in the browser so an unknown reference reads as a plain
  // message instead of a form that fails on submit.
  const code = normaliseResumeCode(searchParams.code ?? "");
  if (code) {
    const registration = await prisma.registration.findUnique({ where: { resumeCode: code } });

    if (!registration) {
      return (
        <Shell heading="Reference not found">
          <div
            role="status"
            className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-6 text-sm text-ras-gray dark:text-white/70"
          >
            <p>
              We could not find a registration for{" "}
              <span className="font-mono font-bold">{code}</span>.
            </p>
            <p className="mt-2">
              Check it against your confirmation email — the reference is six characters. If it
              still does not work, reply to that email and we will sort it out.
            </p>
          </div>
        </Shell>
      );
    }

    const status = isPaymentStatus(registration.paymentStatus)
      ? registration.paymentStatus
      : "UNPAID";

    return (
      <Shell heading={registration.teamName}>
        <div className="rounded-lg border border-ras-purple/30 bg-ras-purple/5 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
              Payment
            </span>
            <PaymentBadge status={registration.paymentStatus} />
            {registration.feeDueFils !== null ? (
              <span className="font-display font-bold text-ras-purple dark:text-white">
                {formatFils(registration.feeDueFils)}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-ras-gray dark:text-white/70">
            {PAYMENT_STATUS_BLURB[status]}
          </p>

          {status === "SUBMITTED" ? (
            <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
              Verification takes {VERIFICATION_WINDOW_TEXT}. You do not need to send anything else.
            </p>
          ) : null}

          {status === "REJECTED" && registration.paymentNote ? (
            <p className="mt-2 text-sm text-accent">{registration.paymentNote}</p>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <Shell heading="Register your team" subheading={config.deadlineText}>
      {config.isOpen ? (
        <RegisterForm feeInfoText={config.feeInfoText} />
      ) : (
        <div
          role="status"
          className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-6 text-sm text-ras-gray dark:text-white/70"
        >
          Registration is currently closed. Check back soon, or contact the organizing committee for
          more information.
        </div>
      )}
    </Shell>
  );
}

function Shell({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        {heading}
      </h1>
      {subheading ? (
        <p className="mt-2 text-sm text-ras-gray dark:text-white/70">{subheading}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}
