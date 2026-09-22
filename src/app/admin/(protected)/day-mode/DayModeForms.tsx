"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { ANNOUNCEMENT_MAX } from "@/lib/day-mode";
import { createAnnouncement, deleteAnnouncement, setDayMode, updateAnnouncement } from "./actions";
import { EMPTY_STATE, type ActionState } from "./state";

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

/**
 * The switch, armed by the first click.
 *
 * Flipping it changes what every visitor sees, so the first press only says
 * what is about to happen and the second one does it. The same two-step shape
 * as deleting a registration, for the same reason: a button that big should
 * not act on a stray tap.
 */
export function DayModeSwitch({ on }: { on: boolean }) {
  const [armed, setArmed] = useState(false);

  // Disarmed once the switch has actually moved, rather than on submit: taking
  // the form away mid-submit would also take away its "Switching…" state.
  useEffect(() => setArmed(false), [on]);

  if (!armed) {
    return (
      <Button type="button" variant={on ? "secondary" : "primary"} onClick={() => setArmed(true)}>
        {on ? "Turn day mode off" : "Turn day mode on"}
      </Button>
    );
  }

  return (
    <form
      action={setDayMode}
      className="rounded-lg border border-ras-crimson/40 bg-ras-crimson/5 p-3"
    >
      <input type="hidden" name="dayMode" value={on ? "off" : "on"} />
      <p className="text-sm text-[var(--color-fg)]">
        {on
          ? "The normal homepage comes back, and Register and Rules reappear in the menu."
          : "The homepage becomes the day site for everyone, and Register and Rules go dark until you turn it off."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SwitchButton on={on} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SwitchButton({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Switching…" : on ? "Yes, back to the normal site" : "Yes, switch the site over"}
    </Button>
  );
}

function Notice({ state }: { state: ActionState }) {
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

function SubmitButton({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export interface AnnouncementRow {
  id: string;
  body: string;
  isPinned: boolean;
  isPublished: boolean;
}

function Fields({ row, idPrefix }: { row?: AnnouncementRow; idPrefix: string }) {
  return (
    <>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-body`}>
          Announcement
        </label>
        <textarea
          id={`${idPrefix}-body`}
          name="body"
          required
          rows={3}
          maxLength={ANNOUNCEMENT_MAX}
          defaultValue={row?.body ?? ""}
          placeholder="Round two starts at 14:00. Teams to the pit area."
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/70">
          <input type="checkbox" name="isPublished" defaultChecked={row ? row.isPublished : true} className="h-4 w-4" />
          Show it
        </label>
        <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/70">
          <input type="checkbox" name="isPinned" defaultChecked={row?.isPinned ?? false} className="h-4 w-4" />
          Pin to the top
        </label>
      </div>
    </>
  );
}

export function AddAnnouncementForm() {
  const [state, action] = useFormState(createAnnouncement, EMPTY_STATE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="mt-3 space-y-3">
      <Fields idPrefix="new" />
      <Notice state={state} />
      <SubmitButton pendingLabel="Posting…">Post announcement</SubmitButton>
    </form>
  );
}

export function EditAnnouncementForm({ row, posted }: { row: AnnouncementRow; posted: string }) {
  const [state, action] = useFormState(updateAnnouncement, EMPTY_STATE);

  return (
    <>
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={row.id} />
        <Fields row={row} idPrefix={row.id} />
        <Notice state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          <span className="text-xs text-ras-gray dark:text-white/55">
            {posted}
            {row.isPublished ? "" : " · not showing"}
          </span>
        </div>
      </form>
      <DeleteAnnouncement row={row} />
    </>
  );
}

function DeleteAnnouncement({ row }: { row: AnnouncementRow }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant="ghost" className="mt-2 text-accent" onClick={() => setArmed(true)}>
        Delete
      </Button>
    );
  }

  const preview = row.body.length > 60 ? `${row.body.slice(0, 60)}…` : row.body;

  return (
    <form
      action={deleteAnnouncement}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-ras-crimson/40 bg-ras-crimson/5 p-2"
    >
      <input type="hidden" name="id" value={row.id} />
      <span className="text-xs text-accent">
        Delete <strong>{preview}</strong>?
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
      {pending ? "Deleting…" : "Yes, delete it"}
    </Button>
  );
}
