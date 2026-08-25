"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  submitPaymentProof,
  type PaymentProofState,
  type PaymentStageData,
} from "@/app/register/actions";
import { CliqPanel } from "@/components/payment/CliqPanel";
import { Button } from "@/components/ui/Button";
import { formatFils, type CliqDetails } from "@/lib/payment";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/gallery";

const initialState: PaymentProofState = { status: "idle" };

interface PaymentStageProps {
  payment: PaymentStageData;
  /** Null when an admin has not switched CliQ on, or has not entered an alias. */
  cliq: CliqDetails | null;
  /** True when the team has already reported a payment for this registration. */
  alreadySubmitted?: boolean;
}

/**
 * Stage two: what the team owes, how to send it, and where to prove they did.
 *
 * Kept on /register rather than behind its own route. The payment is part of
 * registering, not a separate errand, and a team that has just filled in six
 * fields should not be handed a different address to go to.
 */
export function PaymentStage({ payment, cliq, alreadySubmitted = false }: PaymentStageProps) {
  const boundAction = submitPaymentProof.bind(null, payment.resumeCode);
  const [state, formAction] = useFormState(boundAction, initialState);

  const reported = alreadySubmitted || state.status === "success";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ras-purple/30 bg-ras-purple/5 p-6">
        <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
          {payment.teamName} is registered.
        </p>
        <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
          One step left: pay the registration fee. Your place is final once we have matched the
          payment.
        </p>

        <dl className="mt-5 space-y-2 border-t border-ras-purple/20 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ras-gray dark:text-white/70">Registration fee</dt>
            <dd className="text-ras-gray dark:text-white/70">{formatFils(payment.feeBaseFils)}</dd>
          </div>
          {payment.earlyBirdApplied ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ras-gray dark:text-white/70">Early bird discount</dt>
              <dd className="text-ras-gray dark:text-white/70">
                &minus;{formatFils(payment.feeDiscountFils)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-ras-purple/20 pt-2">
            <dt className="font-display font-bold text-ras-purple dark:text-white">Total due</dt>
            <dd className="font-display text-lg font-extrabold text-ras-purple dark:text-white">
              {formatFils(payment.feeDueFils)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-ras-purple/20 pt-4">
          <p className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
            Your payment code
          </p>
          <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.2em] text-ras-purple dark:text-white">
            {payment.resumeCode}
          </p>
          <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
            We have emailed this to you. Keep it — it reopens this page if you close the tab before
            you finish paying.
          </p>
        </div>
      </div>

      {cliq ? (
        <CliqPanel config={cliq} feeInfoText={`Send ${formatFils(payment.feeDueFils)} to the details below.`} />
      ) : (
        <p
          role="status"
          className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-4 text-sm text-ras-gray dark:text-white/70"
        >
          Payment details are not published yet. We will email you as soon as they are — your
          registration is safe in the meantime.
        </p>
      )}

      {reported ? (
        <div
          role="status"
          className="rounded-md border border-ras-purple/30 bg-ras-purple/5 p-6 text-sm text-ras-purple dark:text-white"
        >
          <p className="font-display text-base font-bold">Payment received for checking.</p>
          <p className="mt-1">
            We verify payments within {VERIFICATION_WINDOW_TEXT} and will email you once yours is
            confirmed. You do not need to send anything else.
          </p>
        </div>
      ) : cliq ? (
        <form action={formAction} noValidate className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
              Confirm your payment
            </h2>
            <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
              Once you have transferred the fee, tell us the reference and attach the confirmation
              screenshot from your banking app. We check it within {VERIFICATION_WINDOW_TEXT}.
            </p>
          </div>

          {state.errors?.form ? (
            <p role="alert" className="text-sm text-ras-crimson">
              {state.errors.form}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <ProofField
              id="paymentReference"
              name="paymentReference"
              label="CliQ transaction reference"
              error={state.errors?.reference}
            />
            <ProofField
              id="paymentAmount"
              name="paymentAmount"
              label="Amount transferred (JD)"
              inputMode="decimal"
              error={state.errors?.amount}
            />
          </div>

          <div>
            <label
              htmlFor="screenshot"
              className="block text-sm font-medium text-ras-gray dark:text-white/80"
            >
              Screenshot of your CliQ confirmation
            </label>
            <input
              id="screenshot"
              name="screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-invalid={Boolean(state.errors?.screenshot)}
              aria-describedby={state.errors?.screenshot ? "screenshot-error" : "screenshot-hint"}
              className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] file:mr-3 file:rounded file:border-0 file:bg-ras-purple/10 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-ras-purple focus:border-ras-purple focus:outline-none dark:file:bg-white/10 dark:file:text-white"
            />
            {state.errors?.screenshot ? (
              <p id="screenshot-error" role="alert" className="mt-1 text-sm text-ras-crimson">
                {state.errors.screenshot}
              </p>
            ) : (
              <p id="screenshot-hint" className="mt-1 text-xs text-ras-gray dark:text-white/60">
                JPEG, PNG, WebP or AVIF, up to {formatBytes(MAX_UPLOAD_BYTES)}.
              </p>
            )}
          </div>

          <ProofSubmitButton />
        </form>
      ) : null}
    </div>
  );
}

function ProofSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Submit payment proof"}
    </Button>
  );
}

interface ProofFieldProps {
  id: string;
  name: string;
  label: string;
  error?: string;
  inputMode?: "text" | "decimal" | "numeric";
}

function ProofField({ id, name, label, error, inputMode }: ProofFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ras-gray dark:text-white/80">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-ras-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
