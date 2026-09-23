"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DayIcon } from "@/components/day-site/icons";
import { ALERT_TONE_LABELS, ALERT_TONES, type AlertTone } from "@/lib/day-alerts";
import { ANNOUNCEMENT_MAX } from "@/lib/day-mode";
import { Notice, Submit, Toggle } from "../DeskKit";
import { clearAlert, createAnnouncement, deleteAnnouncement, updateAnnouncement } from "./actions";
import { EMPTY_STATE } from "./state";

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  tone: AlertTone;
  isAlert: boolean;
  isPinned: boolean;
  isPublished: boolean;
}

const TONE_STYLE: Record<AlertTone, string> = {
  INFO: "bg-day-plum/10 text-day-plum",
  URGENT: "bg-day-live/10 text-day-live",
  GOOD: "bg-day-good/10 text-day-good",
};

type Draft = { title: string; body: string; tone: AlertTone };

/** What visitors will see pop up, drawn as the fields change. */
function Preview({ title, body, tone }: Draft) {
  return (
    <div className="day-card relative overflow-hidden p-5" aria-hidden="true">
      <div className="day-stripe-x absolute inset-x-0 top-0 h-1" />
      <p className={`day-kicker ${tone === "URGENT" ? "text-day-live" : tone === "GOOD" ? "text-day-good" : "text-day-plum"}`}>{ALERT_TONE_LABELS[tone]}</p>
      <p className="day-display mt-2 text-xl text-day-ink">{title || (tone === "URGENT" ? "Heads up" : "From the organisers")}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-day-muted">{body || "Your message appears here."}</p>
      <div className="mt-4 flex justify-end">
        <span className="day-btn day-btn-ink day-btn-sm">Got it</span>
      </div>
    </div>
  );
}

function Fields({ row, idPrefix, onChange }: { row?: AnnouncementRow; idPrefix: string; onChange?: (next: Draft) => void }) {
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [tone, setTone] = useState<AlertTone>(row?.tone ?? "INFO");
  useEffect(() => onChange?.({ title, body, tone }), [title, body, tone, onChange]);

  return (
    <div className="space-y-4">
      <div>
        <label className="day-label" htmlFor={`${idPrefix}-title`}>
          Headline (optional)
        </label>
        <input id={`${idPrefix}-title`} name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className="day-input" placeholder="Round two starts at 14:00" />
      </div>
      <div>
        <label className="day-label" htmlFor={`${idPrefix}-body`}>
          Message
        </label>
        <textarea
          id={`${idPrefix}-body`}
          name="body"
          required
          rows={3}
          maxLength={ANNOUNCEMENT_MAX}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Teams to the pit area. The maze is being reset."
          className="day-input"
        />
      </div>
      <div>
        <span className="day-label">Tone</span>
        <div className="day-segment">
          {ALERT_TONES.map((value) => (
            <label key={value}>
              <input type="radio" name="tone" value={value} checked={tone === value} onChange={() => setTone(value)} />
              <span>{ALERT_TONE_LABELS[value]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Toggle name="isAlert" defaultChecked={row ? row.isAlert : true} label="Pop up as an alert" hint="Then stays in the top bar" />
        <Toggle name="isPinned" defaultChecked={row?.isPinned ?? false} label="Pin in the news" />
        <Toggle name="isPublished" defaultChecked={row ? row.isPublished : true} label="Show it" />
      </div>
    </div>
  );
}

export function AddAnnouncementForm() {
  const [state, action] = useFormState(createAnnouncement, EMPTY_STATE);
  const [preview, setPreview] = useState<Draft>({ title: "", body: "", tone: "INFO" });
  const [version, setVersion] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      setVersion((value) => value + 1);
    }
  }, [state]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <form ref={form} action={action} className="space-y-4">
        <Fields key={version} idPrefix="new" onChange={setPreview} />
        <Notice state={state} />
        <Submit pending="Posting…">Post</Submit>
      </form>
      <div className="space-y-2">
        <p className="day-label">What visitors see</p>
        <Preview {...preview} />
      </div>
    </div>
  );
}

function PendingButton({ children, pending: label, className }: { children: string; pending: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? label : children}
    </button>
  );
}

export function AnnouncementCard({ row, posted }: { row: AnnouncementRow; posted: string }) {
  const [state, action] = useFormState(updateAnnouncement, EMPTY_STATE);
  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState(false);

  return (
    <li className={`day-card p-5 ${row.isAlert && row.isPublished ? "ring-2 ring-day-live/30" : row.isPinned ? "ring-1 ring-day-gold/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${TONE_STYLE[row.tone]}`}>{ALERT_TONE_LABELS[row.tone]}</span>
        {row.isAlert ? <span className="rounded-full bg-day-live/10 px-2 py-0.5 text-day-live">Alert · in the top bar</span> : null}
        {row.isPinned ? <span className="rounded-full bg-day-gold/15 px-2 py-0.5 text-day-gold">Pinned</span> : null}
        {!row.isPublished ? <span className="rounded-full bg-day-ink/[0.06] px-2 py-0.5 text-day-muted">Draft</span> : null}
        <span className="text-day-faint">{posted}</span>
      </div>

      {editing ? (
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <Fields row={row} idPrefix={row.id} />
          <Notice state={state} />
          <div className="flex gap-2">
            <Submit pending="Saving…" size="sm">
              Save
            </Submit>
            <button type="button" className="day-btn day-btn-soft day-btn-sm" onClick={() => setEditing(false)}>
              Close
            </button>
          </div>
        </form>
      ) : (
        <>
          {row.title ? <p className="day-display mt-3 text-xl text-day-ink">{row.title}</p> : null}
          <p className="mt-2 whitespace-pre-line text-day-muted">{row.body}</p>
          <Notice state={state} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="day-btn day-btn-soft day-btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            {row.isAlert ? (
              <form action={clearAlert}>
                <input type="hidden" name="id" value={row.id} />
                <PendingButton pending="Clearing…" className="day-btn day-btn-soft day-btn-sm">
                  Clear the alert
                </PendingButton>
              </form>
            ) : null}
            {armed ? (
              <form action={deleteAnnouncement} className="flex gap-2">
                <input type="hidden" name="id" value={row.id} />
                <PendingButton pending="Deleting…" className="day-btn day-btn-danger day-btn-sm">
                  Yes, delete it
                </PendingButton>
                <button type="button" className="day-btn day-btn-soft day-btn-sm" onClick={() => setArmed(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="day-btn day-btn-soft day-btn-sm text-day-live" onClick={() => setArmed(true)}>
                <DayIcon name="close" className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
