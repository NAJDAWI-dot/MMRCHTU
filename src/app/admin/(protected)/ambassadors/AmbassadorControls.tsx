"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createAmbassador,
  deleteAmbassador,
  type AmbassadorFormState,
} from "./actions";
import { Button } from "@/components/ui/Button";
import { UNIVERSITIES } from "@/lib/universities";

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

const initialState: AmbassadorFormState = { status: "idle" };

export function CreateAmbassadorForm() {
  const [state, formAction] = useFormState(createAmbassador, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Cleared only after a successful create, so a rejected code keeps what was typed.
  useEffect(() => {
    if (state.status === "created") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-3" noValidate>
      <div>
        <label htmlFor="ambassador-name" className={labelClass}>
          Name
        </label>
        <input
          id="ambassador-name"
          name="name"
          required
          className={inputClass}
          aria-invalid={Boolean(state.errors?.name)}
        />
        {state.errors?.name ? (
          <p role="alert" className="mt-1 text-xs text-accent">
            {state.errors.name}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="ambassador-university" className={labelClass}>
          University
        </label>
        <select id="ambassador-university" name="university" defaultValue="" className={inputClass}>
          <option value="">Not set</option>
          {UNIVERSITIES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ambassador-code" className={labelClass}>
          Code (leave empty to generate one)
        </label>
        <input
          id="ambassador-code"
          name="code"
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. HTU-OMAR"
          className={`${inputClass} font-mono uppercase`}
          aria-invalid={Boolean(state.errors?.code)}
        />
        {state.errors?.code ? (
          <p role="alert" className="mt-1 text-xs text-accent">
            {state.errors.code}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <SubmitButton />
        {state.status === "created" && state.created ? (
          <p role="status" className="text-sm text-ras-gray dark:text-white/70">
            Created <span className="font-mono font-bold text-ras-purple dark:text-white">{state.created}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create code"}
    </Button>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copy} title={url}>
      {copied === "copied" ? "Link copied" : copied === "failed" ? "Copy failed" : "Copy link"}
    </Button>
  );
}

/** Two-step remove, the same pattern as DeleteRegistration. */
export function RemoveAmbassador({
  id,
  name,
  count,
}: {
  id: string;
  name: string;
  count: number;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setArmed(true)}>
        Remove
      </Button>
    );
  }

  return (
    <form
      action={deleteAmbassador}
      className="flex w-full flex-wrap items-center gap-2 rounded-md border border-ras-crimson/40 bg-ras-crimson/5 p-2"
    >
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-accent">
        Remove <strong>{name}</strong> and their code?
        {count > 0
          ? ` The ${count} team${count === 1 ? "" : "s"} they brought in stay registered but stop counting for them.`
          : ""}
      </span>
      <ConfirmRemove />
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </form>
  );
}

function ConfirmRemove() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Removing…" : "Yes, remove"}
    </Button>
  );
}
