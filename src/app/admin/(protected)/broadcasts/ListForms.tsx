"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { addContacts, importFromRegistrations, sendBroadcastToList } from "./actions";
import { EMPTY_STATE, type ActionState } from "./state";

function Result({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      data-testid="broadcast-notice"
      className={`mt-3 rounded-md px-3 py-2 text-sm ${
        state.ok
          ? "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white"
          : "bg-ras-crimson/10 text-ras-crimson"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: { children: React.ReactNode; pendingLabel: string } & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  // Both reasons to disable must apply — spreading `disabled` after the pending
  // check would let an explicit `disabled={false}` re-enable a submitting form.
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function AddContactsForm({ listId }: { listId: string }) {
  const [state, action] = useFormState(addContacts, EMPTY_STATE);

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="listId" value={listId} />
      <textarea
        name="people"
        rows={4}
        required
        aria-label="People to add"
        className="w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 font-mono text-sm text-[var(--color-fg)]"
      />
      <div className="mt-3">
        <SubmitButton pendingLabel="Adding…">Add to list</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ImportForm({ listId, status }: { listId: string; status: string }) {
  const [state, action] = useFormState(importFromRegistrations, EMPTY_STATE);

  return (
    <form action={action} className="mt-4 border-t border-ras-gray/20 pt-4">
      <input type="hidden" name="listId" value={listId} />
      <p className="text-xs text-ras-gray dark:text-white/60">
        Pull every team member from registrations marked <strong>{status}</strong>. Safe to re-run — people already on
        the list are skipped.
      </p>
      <SubmitButton pendingLabel="Importing…" variant="ghost" className="mt-2 px-3 py-1 text-xs">
        Import from {status} registrations
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function SendBroadcastForm({ listId, contactCount }: { listId: string; contactCount: number }) {
  const [state, action] = useFormState(sendBroadcastToList, EMPTY_STATE);

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="listId" value={listId} />
      <label className="block text-sm">
        <span className="text-ras-gray dark:text-white/70">Subject</span>
        <input
          name="subject"
          required
          className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"
        />
      </label>
      <label className="block text-sm">
        <span className="text-ras-gray dark:text-white/70">Message</span>
        <textarea
          name="body"
          rows={8}
          required
          className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"
        />
      </label>
      <SubmitButton pendingLabel="Sending…" variant="secondary" disabled={contactCount === 0}>
        Send to {contactCount} contact{contactCount === 1 ? "" : "s"}
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}
