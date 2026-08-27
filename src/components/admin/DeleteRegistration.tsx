"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRegistration } from "@/app/admin/(protected)/registrations/actions";

/**
 * Two-step delete for a registration.
 *
 * Deliberately armed by a first click rather than guarded by `window.confirm`:
 * a native dialog cannot be styled, is suppressed outright in some embedded
 * browsers, and cannot be driven by a test — which for the one irreversible
 * action in the admin is the wrong set of trade-offs. Arming in place also
 * lets the second button say exactly which team is about to go, so a misclick
 * on a long list is caught by reading rather than by remembering which row was
 * pressed.
 */
export function DeleteRegistration({ id, teamName }: { id: string; teamName: string }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded px-2 py-1 text-xs font-semibold text-ras-crimson hover:bg-ras-crimson/10"
      >
        Delete
      </button>
    );
  }

  return (
    <form
      action={deleteRegistration}
      className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-ras-crimson/40 bg-ras-crimson/5 p-2"
    >
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-ras-crimson">
        Delete <strong>{teamName}</strong>, its members and its payment screenshot? This cannot be
        undone.
      </span>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="rounded px-2 py-1 text-xs font-semibold text-ras-gray hover:bg-ras-gray/10 dark:text-white/70"
      >
        Cancel
      </button>
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-ras-crimson px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Yes, delete"}
    </button>
  );
}
