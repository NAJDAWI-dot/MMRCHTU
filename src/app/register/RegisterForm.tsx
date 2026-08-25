"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { registerTeam, type RegisterActionState } from "@/app/register/actions";
import { Button } from "@/components/ui/Button";
import { PaymentStage } from "@/components/payment/PaymentStage";
import { IEEE_STATUS_OPTIONS } from "@/lib/ieee-status";
import { formatFils, type CliqDetails } from "@/lib/payment";
import { FEE_TIER_OPTIONS, type FeeBreakdown, type FeeTier } from "@/lib/pricing";
import type { TeamMemberFieldErrors } from "@/lib/registration";
import { UNIVERSITIES } from "@/lib/universities";

const initialState: RegisterActionState = { status: "idle" };

interface RegisterFormProps {
  feeInfoText: string;
  /** Null when an admin has not switched CliQ on, or has not entered an alias. */
  cliq: CliqDetails | null;
  /**
   * The price of each tier, quoted by the server.
   *
   * Computed there rather than from raw prices here so the figure on the radio
   * button is produced by the same function that will charge it — a second
   * implementation in the browser could disagree, and the one people saw before
   * paying is the one that matters.
   */
  quotes: Record<FeeTier, FeeBreakdown>;
}

export function RegisterForm({ feeInfoText, cliq, quotes }: RegisterFormProps) {
  const [state, formAction] = useFormState(registerTeam, initialState);
  const [memberCount, setMemberCount] = useState(1);

  if (state.status === "success" && state.payment) {
    return <PaymentStage payment={state.payment} cliq={cliq} />;
  }

  return (
    <form action={formAction} noValidate className="space-y-6">
      <p className="rounded-md bg-ras-purple/5 p-3 text-xs text-ras-gray dark:bg-white/5 dark:text-white/70">
        {feeInfoText}
      </p>

      <Field
        id="teamName"
        name="teamName"
        label="Team name"
        error={state.errors?.teamName}
        autoComplete="organization"
      />
      <Field
        id="submitterEmail"
        name="submitterEmail"
        type="email"
        label="Submitter email"
        error={state.errors?.submitterEmail}
        autoComplete="email"
      />

      <fieldset>
        <legend className="block text-sm font-medium text-ras-gray dark:text-white/80">
          How many members are in your team?
        </legend>
        <div className="mt-2 flex gap-4">
          {[1, 2, 3].map((n) => (
            <label key={n} className="flex min-h-[44px] items-center gap-2 text-sm text-ras-gray dark:text-white/80">
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
        {state.errors?.memberCount ? (
          <p role="alert" className="mt-1 text-sm text-ras-crimson">
            {state.errors.memberCount}
          </p>
        ) : null}
      </fieldset>

      {Array.from({ length: memberCount }, (_, i) => (
        <MemberFields
          key={i}
          index={i + 1}
          isLeader={i === 0}
          errors={state.errors?.members?.[i]}
        />
      ))}

      <Field
        id="technicalExperience"
        name="technicalExperience"
        label="Briefly describe the technical experience of each member"
        error={state.errors?.technicalExperience}
        textarea
      />
      <Field
        id="motivation"
        name="motivation"
        label="What is your motivation to participate?"
        error={state.errors?.motivation}
        textarea
      />

      <fieldset className="rounded-lg border border-ras-gray/20 p-4">
        <legend className="px-1 font-display text-sm font-bold text-ras-purple dark:text-white">
          Registration fee
        </legend>
        <p className="text-xs text-ras-gray dark:text-white/70">
          One fee per team, based on your team&apos;s IEEE membership. Pick the one that applies —
          you will be asked for your membership ID.
        </p>
        <div className="mt-3 space-y-2">
          {FEE_TIER_OPTIONS.map((opt) => {
            const quote = quotes[opt.value];
            return (
              <label
                key={opt.value}
                className="flex min-h-[44px] cursor-pointer items-start justify-between gap-4 rounded-md border border-ras-gray/20 px-3 py-2 text-sm text-ras-gray transition-colors duration-200 hover:border-ras-purple/40 motion-reduce:transition-none dark:text-white/80"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <input type="radio" name="feeTier" value={opt.value} className="mt-0.5" />
                  <span className="min-w-0">{opt.label}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-display font-bold text-ras-purple dark:text-white">
                    {formatFils(quote.dueFils)}
                  </span>
                  {quote.earlyBirdApplied ? (
                    <span className="block text-xs text-ras-gray line-through dark:text-white/50">
                      {formatFils(quote.baseFils)}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
        {quotes.NON_MEMBER.earlyBirdApplied ? (
          <p className="mt-3 text-xs font-semibold text-ras-crimson">
            Early bird pricing is running — these prices go up when it ends.
          </p>
        ) : null}
        {state.errors?.feeTier ? (
          <p role="alert" className="mt-2 text-sm text-ras-crimson">
            {state.errors.feeTier}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ras-gray dark:text-white/80">
          <input
            type="checkbox"
            name="consentAccepted"
            className="mt-0.5"
            aria-invalid={Boolean(state.errors?.consentAccepted)}
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
            </Link>{" "}
            and the{" "}
            <Link
              href="/legal/code-of-conduct"
              className="font-semibold text-ras-purple underline dark:text-white"
            >
              Code of Conduct
            </Link>
            .
          </span>
        </label>
        {state.errors?.consentAccepted ? (
          <p role="alert" className="mt-1 text-sm text-ras-crimson">
            {state.errors.consentAccepted}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
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
        <Field
          id={`${prefix}Email`}
          name={`${prefix}Email`}
          type="email"
          label="Email"
          error={errors?.email}
        />
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
        <span className="block text-sm font-medium text-ras-gray dark:text-white/80">IEEE membership status</span>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
          {IEEE_STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex min-h-[44px] items-center gap-2 text-sm text-ras-gray dark:text-white/80">
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Register team"}
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
