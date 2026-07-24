"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAdmin, type LoginActionState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/Button";

const initialState: LoginActionState = { status: "idle" };

export function LoginForm() {
  const [state, formAction] = useFormState(loginAdmin, initialState);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-ras-gray dark:text-white/80">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ras-gray dark:text-white/80">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
        />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-ras-crimson">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
