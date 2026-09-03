"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createAdmin, type AdminFormState } from "./actions";
import { Button } from "@/components/ui/Button";

const initialState: AdminFormState = { status: "idle" };

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export function CreateAdminForm() {
  const [state, formAction] = useFormState(createAdmin, initialState);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Username</label>
        <input name="username" required minLength={3} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <input name="password" type="password" required minLength={8} className={inputClass} />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-accent sm:col-span-2">
          {state.error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create admin"}
    </Button>
  );
}
