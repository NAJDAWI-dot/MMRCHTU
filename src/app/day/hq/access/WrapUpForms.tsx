"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DEVELOPER_MESSAGE_MAX } from "@/lib/wrap-up";
import { saveDeveloperMessage, setWrapUp } from "./actions";
import { EMPTY_STATE, type ActionState } from "./state";

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-[4px] px-3.5 py-2.5 text-sm font-medium ${state.ok ? "bg-day-good/10 text-day-good" : "bg-day-live/10 text-day-live"}`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ children, pending: busy = "Saving…", disabled }: { children: string; pending?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="day-btn day-btn-ink">
      {pending ? busy : children}
    </button>
  );
}

/**
 * The switch for after the day. Turning it on asks twice, like going public
 * does: it changes what every visitor to mmrchtu.tech sees.
 */
export function WrapUpSwitch({ on }: { on: boolean }) {
  const [state, action] = useFormState(setWrapUp, EMPTY_STATE);
  const [sure, setSure] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="wrapUp" value={on ? "off" : "on"} />
      {on ? null : (
        <label className="flex items-start gap-2 rounded-[4px] bg-day-gold/10 p-4 text-sm text-day-ink ring-1 ring-day-gold/40">
          <input type="checkbox" checked={sure} onChange={(event) => setSure(event.target.checked)} className="mt-0.5 h-4 w-4" />
          Yes, the competition is over. mmrchtu.tech will open on the thank-you page with the results, Rules come back, and
          Register closes for good.
        </label>
      )}
      <SubmitButton disabled={!on && !sure}>{on ? "Undo: back to the day site" : "The competition is over"}</SubmitButton>
      <Notice state={state} />
    </form>
  );
}

/** The developer's letter on the thank-you page. Empty shows the draft. */
export function DeveloperMessageForm({ message, draft }: { message: string; draft: string }) {
  const [state, action] = useFormState(saveDeveloperMessage, EMPTY_STATE);
  const [text, setText] = useState(message || draft);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="developer-message" className="day-label">
        A message from the developer
      </label>
      <p className="text-sm text-day-muted">Shown as a signed letter at the end of the thank-you page. Leave a blank line between paragraphs.</p>
      <textarea
        id="developer-message"
        name="message"
        rows={10}
        maxLength={DEVELOPER_MESSAGE_MAX}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="day-input w-full text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save the message</SubmitButton>
        <button type="button" onClick={() => setText(draft)} className="day-btn day-btn-soft day-btn-sm">
          Start from the draft
        </button>
        <span className="day-num ml-auto text-xs text-day-faint">
          {text.length} / {DEVELOPER_MESSAGE_MAX}
        </span>
      </div>
      <Notice state={state} />
    </form>
  );
}
