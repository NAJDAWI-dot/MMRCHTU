"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { hostLabel } from "@/lib/links";
import { KIND_LABELS, REFERENCE_KINDS, parseKind } from "@/lib/references";
import { createReference, deleteReference, updateReference } from "./actions";
import { EMPTY_STATE, type ActionState } from "./state";

/**
 * The add and edit forms for the reading list.
 *
 * Client components only because of `useFormState`: a mistyped link has to
 * come back as a sentence next to the field, not as the blank error screen a
 * thrown server action produces. The fields themselves are the same markup in
 * both forms, written once here.
 */

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export interface ReferenceRow {
  id: string;
  kind: string;
  title: string;
  url: string;
  author: string;
  note: string;
  sortOrder: number;
  isPublished: boolean;
}

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`sm:col-span-2 rounded-md px-3 py-2 text-sm ${
        state.ok
          ? "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white"
          : "bg-ras-crimson/10 text-accent"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function Fields({
  reference,
  idPrefix,
  defaultSortOrder = 0,
}: {
  reference?: ReferenceRow;
  idPrefix: string;
  /** Where a new row lands: past the end of the list, with room to spare. */
  defaultSortOrder?: number;
}) {
  return (
    <>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-kind`}>
          Kind
        </label>
        <select
          id={`${idPrefix}-kind`}
          name="kind"
          defaultValue={reference ? parseKind(reference.kind) : "VIDEO"}
          className={inputClass}
        >
          {REFERENCE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-url`}>
          Link
        </label>
        <input
          id={`${idPrefix}-url`}
          name="url"
          required
          defaultValue={reference?.url ?? ""}
          placeholder="https://www.youtube.com/watch?v=..."
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-title`}>
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          name="title"
          required
          defaultValue={reference?.title ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-author`}>
          Channel or site
        </label>
        <input
          id={`${idPrefix}-author`}
          name="author"
          defaultValue={reference?.author ?? ""}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor={`${idPrefix}-note`}>
          Why it is worth their time
        </label>
        <textarea
          id={`${idPrefix}-note`}
          name="note"
          rows={2}
          defaultValue={reference?.note ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-sort`}>
          Sort order
        </label>
        <input
          id={`${idPrefix}-sort`}
          name="sortOrder"
          type="number"
          defaultValue={reference?.sortOrder ?? defaultSortOrder}
          className={inputClass}
        />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm text-ras-gray dark:text-white/70">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={reference ? reference.isPublished : true}
          className="h-4 w-4"
        />
        Show it on the page
      </label>
    </>
  );
}

export function AddReferenceForm({ nextSortOrder }: { nextSortOrder: number }) {
  const [state, action] = useFormState(createReference, EMPTY_STATE);
  const form = useRef<HTMLFormElement>(null);

  // Emptied on success, so the next link is typed into a clean form rather
  // than over the top of the last one.
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Fields idPrefix="new" defaultSortOrder={nextSortOrder} />
      <Notice state={state} />
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add reference</SubmitButton>
      </div>
    </form>
  );
}

export function EditReferenceForm({ reference }: { reference: ReferenceRow }) {
  const [state, action] = useFormState(updateReference, EMPTY_STATE);

  return (
    <>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={reference.id} />
        <Fields reference={reference} idPrefix={reference.id} />
        <Notice state={state} />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ras-gray underline-offset-2 hover:underline dark:text-white/60"
          >
            Open {hostLabel(reference.url)} ↗
          </a>
        </div>
      </form>
      <DeleteReference reference={reference} />
    </>
  );
}

/**
 * Two-step delete, armed by the first click.
 *
 * The same shape as deleting a registration, and for the same reason: Delete
 * sits under Save on every row of a long list, and the second button names the
 * link that is about to go so a misclick is caught by reading rather than by
 * remembering which row was pressed.
 */
function DeleteReference({ reference }: { reference: ReferenceRow }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="mt-2 text-accent"
        onClick={() => setArmed(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <form
      action={deleteReference}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-ras-crimson/40 bg-ras-crimson/5 p-2"
    >
      <input type="hidden" name="id" value={reference.id} />
      <span className="text-xs text-accent">
        Remove <strong>{reference.title}</strong> from the guide?
      </span>
      <DeleteButton />
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Removing…" : "Yes, remove it"}
    </Button>
  );
}
