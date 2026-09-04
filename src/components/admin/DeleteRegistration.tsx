"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRegistration } from "@/app/admin/(protected)/registrations/actions";
import { Button } from "@/components/ui/Button";

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
      <Button type="button" variant="destructive" size="sm" onClick={() => setArmed(true)}>
        Delete
      </Button>
    );
  }

  return (
    <form
      action={deleteRegistration}
      className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-ras-crimson/40 bg-ras-crimson/5 p-2"
    >
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-accent">
        Delete <strong>{teamName}</strong>, its members and its payment screenshot? This cannot be
        undone.
      </span>
      <ConfirmButton />
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Deleting…" : "Yes, delete"}
    </Button>
  );
}
