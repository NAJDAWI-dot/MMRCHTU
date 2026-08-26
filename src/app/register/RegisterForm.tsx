"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import {
  checkTeamDetails,
  completeRegistration,
  type CompleteRegistrationState,
  type TeamCheckState,
} from "@/app/register/actions";
import { Button } from "@/components/ui/Button";
import { CliqPanel } from "@/components/payment/CliqPanel";
import { IEEE_STATUS_OPTIONS } from "@/lib/ieee-status";
import { formatFils, type CliqDetails } from "@/lib/payment";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/gallery";
import type { FeeBreakdown } from "@/lib/pricing";
import type { FieldErrors, TeamMemberFieldErrors } from "@/lib/registration";
import { UNIVERSITIES } from "@/lib/universities";

const initialSubmit: CompleteRegistrationState = { status: "idle" };

/**
 * Where stage one's answers wait while the team goes to their banking app.
 *
 * Nothing reaches the server until they report a payment, so this is the only
 * copy — and it lives in their browser, on their device. That is why the
 * privacy policy mentions it, and why it is cleared the moment the
 * registration is actually recorded.
 */
const CACHE_KEY = "mmrc26.registration.draft";

interface RegisterFormProps {
  feeInfoText: string;
}

export function RegisterForm({ feeInfoText }: RegisterFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [memberCount, setMemberCount] = useState(1);
  const [teamErrors, setTeamErrors] = useState<FieldErrors | undefined>();
  // Registration having closed, or too many attempts — neither belongs against
  // a field, because neither is fixed by editing one.
  const [formError, setFormError] = useState<string | undefined>();
  const [fee, setFee] = useState<FeeBreakdown | undefined>();
  // Arrives with the Next response rather than as a prop, so step one's page
  // source carries nothing about how to pay.
  const [cliq, setCliq] = useState<CliqDetails | null>(null);
  const [checking, setChecking] = useState(false);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const [submitState, submitAction] = useFormState(completeRegistration, initialSubmit);

  // Restored after mount rather than during render: reading localStorage while
  // rendering would make the server's HTML and the browser's first pass
  // disagree, and React would throw the whole tree away.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const count = Number(parsed.memberCount ?? 1);
      if (count >= 1 && count <= 3) setMemberCount(count);
      setDraft(parsed);
    } catch {
      // A corrupt or unreadable draft is not worth surfacing — the form starts
      // empty, which is where it would have started anyway.
    }
  }, []);

  // Waits on memberCount so the extra member fieldsets exist before their
  // values are written back into them.
  useEffect(() => {
    if (!draft || !formRef.current) return;
    for (const [name, value] of Object.entries(draft)) {
      const found = formRef.current.elements.namedItem(name);
      if (!found) continue;
      const list = found instanceof RadioNodeList ? Array.from(found) : [found];
      for (const element of list) {
        if (element instanceof HTMLInputElement && element.type === "radio") {
          element.checked = element.value === value;
        } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
          element.checked = value === "on";
        } else if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          element.value = value;
        }
      }
    }
    setDraft(null);
  }, [draft, memberCount]);

  useEffect(() => {
    if (submitState.status !== "success") return;
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      // Nothing to do — the registration is recorded either way.
    }
  }, [submitState.status]);

  async function handleNext() {
    if (!formRef.current) return;
    setChecking(true);
    try {
      const formData = new FormData(formRef.current);
      const result: TeamCheckState = await checkTeamDetails({ status: "idle" }, formData);

      if (result.status === "error") {
        setTeamErrors(result.errors);
        setFormError(result.formError);
        return;
      }

      setTeamErrors(undefined);
      setFormError(undefined);
      setFee(result.fee);
      setCliq(result.cliq ?? null);

      const toSave: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") toSave[key] = value;
      }
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
      } catch {
        // Private browsing, or storage full. Losing the draft is a nuisance,
        // not a reason to stop someone carrying on to payment.
      }

      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setChecking(false);
    }
  }

  if (submitState.status === "success" && submitState.registered) {
    return <Registered registered={submitState.registered} />;
  }

  const errors = submitState.teamErrors ?? teamErrors;

  return (
    <form
      ref={formRef}
      action={submitAction}
      noValidate
      // Stage one has no server action of its own — Next is a button, not a
      // submit. Without this, pressing Enter in a text field would post the
      // half-filled form straight to the final action.
      onSubmit={(event) => {
        if (step === 1) event.preventDefault();
      }}
      className="space-y-6"
    >
      <Steps step={step} />

      {/* Kept mounted through stage two rather than unmounted: hidden fields
          still submit, so the final POST carries the team details without
          having to round-trip them through the server first. */}
      <div hidden={step !== 1} className={step === 1 ? "space-y-6" : undefined}>
        <p className="rounded-md bg-ras-purple/5 p-3 text-xs text-ras-gray dark:bg-white/5 dark:text-white/70">
          {feeInfoText}
        </p>

        <Field
          id="teamName"
          name="teamName"
          label="Team name"
          error={errors?.teamName}
          autoComplete="organization"
        />
        <Field
          id="submitterEmail"
          name="submitterEmail"
          type="email"
          label="Submitter email"
          error={errors?.submitterEmail}
          autoComplete="email"
        />

        <fieldset>
          <legend className="block text-sm font-medium text-ras-gray dark:text-white/80">
            How many members are in your team?
          </legend>
          <div className="mt-2 flex gap-4">
            {[1, 2, 3].map((n) => (
              <label
                key={n}
                className="flex min-h-[44px] items-center gap-2 text-sm text-ras-gray dark:text-white/80"
              >
                <input
                  type="radio"
                  name="memberCount"
                  value={n}
                  checked={memberCount === n}
                  onChange={() => setMemberCount(n)}
                />
                {n} member{n > 1 ? "s" : ""}
              </label>
            ))}
          </div>
          {errors?.memberCount ? (
            <p role="alert" className="mt-1 text-sm text-ras-crimson">
              {errors.memberCount}
            </p>
          ) : null}
        </fieldset>

        {Array.from({ length: memberCount }, (_, i) => (
          <MemberFields key={i} index={i + 1} isLeader={i === 0} errors={errors?.members?.[i]} />
        ))}

        <Field
          id="technicalExperience"
          name="technicalExperience"
          label="Briefly describe the technical experience of each member"
          error={errors?.technicalExperience}
          textarea
        />
        <Field
          id="motivation"
          name="motivation"
          label="What is your motivation to participate?"
          error={errors?.motivation}
          textarea
        />

        <div>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ras-gray dark:text-white/80">
            <input
              type="checkbox"
              name="consentAccepted"
              className="mt-0.5"
              aria-invalid={Boolean(errors?.consentAccepted)}
            />
            <span className="min-w-0">
              I have read and accept the{" "}
              <Link href="/legal/terms" className="font-semibold text-ras-purple underline dark:text-white">
                Terms of Service
              </Link>
              , the{" "}
              <Link href="/legal/privacy" className="font-semibold text-ras-purple underline dark:text-white">
                Privacy Policy
              </Link>
              , the{" "}
              <Link
                href="/legal/payment-refund-policy"
                className="font-semibold text-ras-purple underline dark:text-white"
              >
                Payment &amp; Refund Policy
              </Link>
              , the{" "}
              <Link
                href="/legal/code-of-conduct"
                className="font-semibold text-ras-purple underline dark:text-white"
              >
                Code of Conduct
              </Link>{" "}
              and the{" "}
              <Link href="/rules" className="font-semibold text-ras-purple underline dark:text-white">
                competition rules
              </Link>
              .
            </span>
          </label>
          {errors?.consentAccepted ? (
            <p role="alert" className="mt-1 text-sm text-ras-crimson">
              {errors.consentAccepted}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-md border border-ras-crimson/30 bg-ras-crimson/5 p-3 text-sm text-ras-crimson"
          >
            {formError}
          </p>
        ) : null}

        <Button type="button" onClick={handleNext} disabled={checking}>
          {checking ? "Checking…" : "Next: payment"}
        </Button>
      </div>

      {step === 2 && fee ? (
        <PaymentStep
          fee={fee}
          cliq={cliq}
          errors={submitState.errors}
          onBack={() => {
            setStep(1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : null}
    </form>
  );
}

function Steps({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1 as const, label: "Your team" },
    { n: 2 as const, label: "Payment" },
  ];

  return (
    <ol className="flex items-center gap-3 text-xs font-semibold" aria-label="Registration progress">
      {steps.map(({ n, label }) => (
        <li key={n} className="flex items-center gap-2">
          <span
            aria-current={step === n ? "step" : undefined}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              step >= n
                ? "bg-ras-purple text-white"
                : "bg-ras-gray/15 text-ras-gray dark:bg-white/10 dark:text-white/60"
            }`}
          >
            {n}
          </span>
          <span
            className={step === n ? "text-ras-purple dark:text-white" : "text-ras-gray dark:text-white/60"}
          >
            {label}
          </span>
          {n === 1 ? (
            <span aria-hidden className="text-ras-gray/40">
              —
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

interface PaymentStepProps {
  fee: FeeBreakdown;
  cliq: CliqDetails | null;
  errors?: { reference?: string; amount?: string; screenshot?: string; form?: string };
  onBack: () => void;
}

function PaymentStep({ fee, cliq, errors, onBack }: PaymentStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ras-purple/30 bg-ras-purple/5 p-6">
        <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
          What your team owes
        </h2>
        <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
          Priced from your team leader&apos;s IEEE membership status.
        </p>

        <dl className="mt-4 space-y-2 border-t border-ras-purple/20 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ras-gray dark:text-white/70">Registration fee</dt>
            <dd className="text-ras-gray dark:text-white/70">{formatFils(fee.baseFils)}</dd>
          </div>
          {fee.earlyBirdApplied ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ras-gray dark:text-white/70">Early bird discount</dt>
              <dd className="text-ras-gray dark:text-white/70">
                &minus;{formatFils(fee.discountFils)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-ras-purple/20 pt-2">
            <dt className="font-display font-bold text-ras-purple dark:text-white">Total due</dt>
            <dd className="font-display text-lg font-extrabold text-ras-purple dark:text-white">
              {formatFils(fee.dueFils)}
            </dd>
          </div>
        </dl>
      </div>

      {cliq ? (
        <CliqPanel
          config={cliq}
          feeInfoText={`Send ${formatFils(fee.dueFils)} to the details below.`}
        />
      ) : (
        <p
          role="status"
          className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-4 text-sm text-ras-gray dark:text-white/70"
        >
          Payment details are not published yet. Please check back shortly — your team is not
          registered until the fee is paid.
        </p>
      )}

      {cliq ? (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
              Confirm your payment
            </h2>
            <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
              Once you have transferred the fee, enter the reference and attach the confirmation
              screenshot from your banking app. Submitting this completes your registration. We
              verify payments within {VERIFICATION_WINDOW_TEXT}.
            </p>
          </div>

          {errors?.form ? (
            <p role="alert" className="text-sm text-ras-crimson">
              {errors.form}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="paymentReference"
              name="paymentReference"
              label="CliQ transaction reference"
              error={errors?.reference}
            />
            <Field
              id="paymentAmount"
              name="paymentAmount"
              label="Amount transferred (JD)"
              inputMode="decimal"
              error={errors?.amount}
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
              aria-invalid={Boolean(errors?.screenshot)}
              aria-describedby={errors?.screenshot ? "screenshot-error" : "screenshot-hint"}
              className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] file:mr-3 file:rounded file:border-0 file:bg-ras-purple/10 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-ras-purple focus:border-ras-purple focus:outline-none dark:file:bg-white/10 dark:file:text-white"
            />
            {errors?.screenshot ? (
              <p id="screenshot-error" role="alert" className="mt-1 text-sm text-ras-crimson">
                {errors.screenshot}
              </p>
            ) : (
              <p id="screenshot-hint" className="mt-1 text-xs text-ras-gray dark:text-white/60">
                JPEG, PNG, WebP or AVIF, up to {formatBytes(MAX_UPLOAD_BYTES)}.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        {cliq ? <FinalSubmitButton /> : null}
      </div>
    </div>
  );
}

function Registered({
  registered,
}: {
  registered: { teamName: string; resumeCode: string; feeDueFils: number };
}) {
  return (
    <div
      role="status"
      className="rounded-lg border border-ras-purple/30 bg-ras-purple/5 p-6 text-ras-purple dark:text-white"
    >
      <p className="font-display text-lg font-bold">You&apos;re registered! 🐭</p>
      <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
        {registered.teamName} is in, and we have your payment of{" "}
        {formatFils(registered.feeDueFils)} for checking.
      </p>

      <div className="mt-4 border-t border-ras-purple/20 pt-4">
        <p className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
          Your reference
        </p>
        <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.2em]">
          {registered.resumeCode}
        </p>
      </div>

      <p className="mt-4 text-sm text-ras-gray dark:text-white/70">
        Payment verification takes {VERIFICATION_WINDOW_TEXT}. We have emailed you a copy of your
        registration and will email again once your payment is confirmed. You do not need to send
        anything else.
      </p>
    </div>
  );
}

interface MemberFieldsProps {
  index: number;
  isLeader: boolean;
  errors?: TeamMemberFieldErrors;
}

function MemberFields({ index, isLeader, errors }: MemberFieldsProps) {
  const prefix = `member${index}`;

  return (
    <fieldset className="rounded-lg border border-ras-gray/20 p-4">
      <legend className="px-1 font-display text-sm font-bold text-ras-purple dark:text-white">
        {isLeader ? "Team Leader" : `Member ${index}`}
      </legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}FirstName`} name={`${prefix}FirstName`} label="First name" error={errors?.firstName} />
        <Field id={`${prefix}LastName`} name={`${prefix}LastName`} label="Last name" error={errors?.lastName} />
        <Field id={`${prefix}Email`} name={`${prefix}Email`} type="email" label="Email" error={errors?.email} />
        <Field id={`${prefix}Whatsapp`} name={`${prefix}Whatsapp`} label="WhatsApp number" error={errors?.whatsapp} />
        <div>
          <label htmlFor={`${prefix}University`} className="block text-sm font-medium text-ras-gray dark:text-white/80">
            University
          </label>
          <select
            id={`${prefix}University`}
            name={`${prefix}University`}
            className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>
              Select a university
            </option>
            {UNIVERSITIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {errors?.university ? (
            <p role="alert" className="mt-1 text-sm text-ras-crimson">
              {errors.university}
            </p>
          ) : null}
        </div>
        <Field id={`${prefix}Major`} name={`${prefix}Major`} label="Major" error={errors?.major} />
      </div>

      <div className="mt-4">
        <span className="block text-sm font-medium text-ras-gray dark:text-white/80">
          IEEE membership status
        </span>
        {isLeader ? (
          <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
            This sets your team&apos;s registration fee.
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
          {IEEE_STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex min-h-[44px] items-center gap-2 text-sm text-ras-gray dark:text-white/80"
            >
              <input type="radio" name={`${prefix}IeeeStatus`} value={opt.value} />
              {opt.label}
            </label>
          ))}
        </div>
        {errors?.ieeeStatus ? (
          <p role="alert" className="mt-1 text-sm text-ras-crimson">
            {errors.ieeeStatus}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <Field
          id={`${prefix}IeeeMembershipId`}
          name={`${prefix}IeeeMembershipId`}
          label='IEEE membership ID (write "Non-Member" if not)'
          error={errors?.ieeeMembershipId}
        />
      </div>
    </fieldset>
  );
}

function FinalSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Complete registration"}
    </Button>
  );
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "decimal" | "numeric";
  textarea?: boolean;
}

function Field({ id, name, label, error, type = "text", textarea = false, ...rest }: FieldProps) {
  const errorId = `${id}-error`;
  const className =
    "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ras-gray dark:text-white/80">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          rows={3}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={className}
          {...rest}
        />
      )}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-ras-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
