"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { EMPTY_DESK_STATE, type DeskState } from "./state";

/**
 * The pieces every HQ desk form is built from, in the day site's design.
 *
 * One form shape everywhere: the action answers with a sentence, shown next to
 * the button, rather than throwing and leaving the desk on a blank error page
 * in the middle of the day.
 */

export const inputClass = "day-input";
export const labelClass = "day-label";

export function Notice({ state }: { state: DeskState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`day-banner-in flex items-start gap-2 rounded-[4px] px-3.5 py-2.5 text-sm font-medium ${
        state.ok ? "bg-day-good/10 text-day-good" : "bg-day-live/10 text-day-live"
      }`}
    >
      <DayIcon name={state.ok ? "check" : "close"} className="mt-0.5 h-4 w-4 shrink-0" />
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
  variant?: "primary" | "secondary" | "ghost" | "good" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  const tone = {
    primary: "day-btn-ink",
    secondary: "day-btn-soft",
    ghost: "day-btn-soft",
    good: "day-btn-good",
    danger: "day-btn-danger",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`day-btn ${tone} ${size === "sm" ? "day-btn-sm" : ""}`}>
      {pending ? pendingLabel : children}
    </button>
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
  className = "space-y-4",
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
    <div className="space-y-3">
      {armed ? (
        <form
          action={formAction}
          className={`day-dialog space-y-4 rounded-[4px] border p-4 ${destructive ? "border-day-live/30 bg-day-live/[0.05]" : "border-day-plum/30 bg-day-plum/[0.05]"}`}
        >
          <div className="text-sm text-day-ink">{warning}</div>
          {children}
          <div className="flex flex-wrap gap-2">
            <Submit pending="Working…" size="sm" variant={destructive ? "danger" : "primary"}>
              {confirm}
            </Submit>
            <button type="button" className="day-btn day-btn-soft day-btn-sm" onClick={() => setArmed(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={`day-btn ${destructive ? "day-btn-danger" : "day-btn-ink"}`} onClick={() => setArmed(true)}>
          {label}
        </button>
      )}
      <Notice state={state} />
    </div>
  );
}

/** A desk's heading: what it is for, in one line, and anything it needs at hand. */
export function DeskHead({ icon, title, lead, children }: { icon: DayIconName; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div>
          <h1 className="day-display flex items-center gap-3 text-3xl text-day-ink sm:text-[2.6rem]">
            <DayIcon name={icon} className="h-7 w-7 shrink-0 text-day-crimson" />
            {title}
          </h1>
          {lead ? <p className="mt-2 max-w-2xl text-day-muted">{lead}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/** A switch that posts as a checkbox: "on" when set, nothing when not. */
export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-[5px] bg-day-ink/15 transition-colors peer-checked:bg-day-good peer-focus-visible:ring-2 peer-focus-visible:ring-day-crimson" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-[3px] bg-white shadow transition-transform duration-300 peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-day-ink">{label}</span>
        {hint ? <span className="block text-xs text-day-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
