"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registerTeam, type RegisterActionState } from "@/app/register/actions";
import { Button } from "@/components/ui/Button";

const initialState: RegisterActionState = { status: "idle" };

export function RegisterForm() {
  const [state, formAction] = useFormState(registerTeam, initialState);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-md border border-ras-purple/30 bg-ras-purple/5 p-6 text-ras-purple dark:text-white"
      >
        <p className="font-display text-lg font-bold">You&apos;re registered!</p>
        <p className="mt-1 text-sm">
          We&apos;ll email your team with next steps as the competition date approaches.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-5">
      <Field
        id="teamName"
        name="teamName"
        label="Team name"
        error={state.errors?.teamName}
        autoComplete="organization"
      />
      <Field
        id="contactName"
        name="contactName"
        label="Contact name"
        error={state.errors?.contactName}
        autoComplete="name"
      />
      <Field
        id="email"
        name="email"
        type="email"
        label="Contact email"
        error={state.errors?.email}
        autoComplete="email"
      />
      <Field
        id="memberCount"
        name="memberCount"
        type="number"
        label="Team size"
        error={state.errors?.memberCount}
        defaultValue="1"
        min={1}
        max={10}
      />
      <SubmitButton />
    </form>
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
  defaultValue?: string;
  min?: number;
  max?: number;
}

function Field({ id, name, label, error, type = "text", ...rest }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ras-gray dark:text-white/80">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-ras-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
