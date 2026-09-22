"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { EMPTY_DESK_STATE, type DeskState } from "./state";

/**
 * The pieces every HQ desk form is built from.
 *
 * One form shape everywhere: the action answers with a sentence, shown next to
 * the button, rather than throwing and leaving the desk on a blank error page
 * in the middle of the day.
 */

export const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
export const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export function Notice({ state }: { state: DeskState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-sm ${
        state.ok
          ? "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white"
          : "bg-ras-crimson/10 text-accent"
      }`}
    >
      {state.message}
    </p>
  );
}

export function Submit({
  children,
  pending: pendingLabel,
  variant = "primary",
  size = "md",
}: {
  children: ReactNode;
  pending: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

type DeskAction = (state: DeskState, formData: FormData) => Promise<DeskState>;

/**
 * A form wired to a desk action, with its notice underneath. `resetOnSuccess`
 * empties it after a good save, for forms that add a row.
 */
export function DeskForm({
  action,
  children,
  className = "space-y-3",
  resetOnSuccess = false,
}: {
  action: DeskAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState(action, EMPTY_DESK_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <Notice state={state} />
    </form>
  );
}

/**
 * A button that asks before it acts. The first press shows what is about to
 * happen and the real button; used for the draw, the reset and deletes.
 */
export function ArmedForm({
  action,
  label,
  warning,
  confirm,
  children,
  destructive = false,
}: {
  action: DeskAction;
  label: string;
  warning: ReactNode;
  confirm: string;
  children?: ReactNode;
  destructive?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [state, formAction] = useFormState(action, EMPTY_DESK_STATE);

  useEffect(() => {
    if (state.ok) setArmed(false);
  }, [state]);

  return (
    <div className="space-y-2">
      {armed ? (
        <form
          action={formAction}
          className={`space-y-3 rounded-lg border p-3 ${
            destructive ? "border-ras-crimson/40 bg-ras-crimson/5" : "border-ras-purple/30 bg-ras-purple/5"
          }`}
        >
          <div className="text-sm text-[var(--color-fg)]">{warning}</div>
          {children}
          <div className="flex flex-wrap gap-2">
            <Submit pending="Working…" size="sm">
              {confirm}
            </Submit>
            <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant={destructive ? "secondary" : "primary"} onClick={() => setArmed(true)}>
          {label}
        </Button>
      )}
      <Notice state={state} />
    </div>
  );
}
