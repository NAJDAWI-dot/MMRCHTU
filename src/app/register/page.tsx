import type { Metadata } from "next";
import { RegisterForm } from "@/app/register/RegisterForm";
import { PaymentStage } from "@/components/payment/PaymentStage";
import { getPaymentConfig, getRegisterFormConfig } from "@/lib/site-config";
import { isPaymentConfigured } from "@/lib/payment";
import { computeFee, FEE_TIER_OPTIONS, type FeeBreakdown, type FeeTier } from "@/lib/pricing";
import { normaliseResumeCode } from "@/lib/registration-code";
import { prisma } from "@/lib/prisma";

// A resumed payment reads one registration row, so this page cannot be cached
// wholesale. Without a code it is still just configuration, and closing
// registration revalidates the path immediately.
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
  const [config, paymentConfig] = await Promise.all([
    getRegisterFormConfig(),
    getPaymentConfig(),
  ]);

  // Null unless an admin has switched payment on *and* entered an alias — a
  // panel with a blank alias would send money nowhere.
  const cliq = isPaymentConfigured(paymentConfig) ? paymentConfig : null;

  // Someone coming back from their email to finish paying. Resolved here rather
  // than in the client so a bad code renders as a plain message instead of a
  // form that fails on submit.
  const code = normaliseResumeCode(searchParams.code ?? "");
  if (code) {
    const registration = await prisma.registration.findUnique({ where: { resumeCode: code } });

    if (!registration) {
      return (
        <Shell heading="Payment code not found">
          <div
            role="status"
            className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-6 text-sm text-ras-gray dark:text-white/70"
          >
            <p>
              We could not find a registration for the code{" "}
              <span className="font-mono font-bold">{code}</span>.
            </p>
            <p className="mt-2">
              Check it against your confirmation email — the code is six characters. If it still
              does not work, reply to that email and we will sort it out.
            </p>
          </div>
        </Shell>
      );
    }

    return (
      <Shell heading="Finish your registration">
        <PaymentStage
          payment={{
            resumeCode: code,
            teamName: registration.teamName,
            feeBaseFils: registration.feeBaseFils ?? 0,
            feeDiscountFils: registration.feeDiscountFils ?? 0,
            feeDueFils: registration.feeDueFils ?? 0,
            earlyBirdApplied: (registration.feeDiscountFils ?? 0) > 0,
          }}
          cliq={cliq}
          // Anything past UNPAID means they have already told us something; the
          // form would only let them report a second time over the first.
          alreadySubmitted={registration.paymentStatus !== "UNPAID"}
        />
      </Shell>
    );
  }

  // Priced once here and handed to the form, so the amount on each radio button
  // comes from the same function that will charge it.
  const now = new Date();
  const quotes = Object.fromEntries(
    FEE_TIER_OPTIONS.map((opt) => [
      opt.value,
      computeFee(opt.value, paymentConfig, paymentConfig, now),
    ]),
  ) as Record<FeeTier, FeeBreakdown>;

  return (
    <Shell heading="Register your team" subheading={config.deadlineText}>
      {config.isOpen ? (
        <RegisterForm feeInfoText={config.feeInfoText} cliq={cliq} quotes={quotes} />
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
