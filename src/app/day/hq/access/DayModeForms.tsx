"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DAY_AUDIENCES, DAY_AUDIENCE_HINTS, DAY_AUDIENCE_LABELS, type DayAudience } from "@/lib/day-audience";
import { setAudience } from "./actions";
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

function SubmitButton({ children, variant = "primary" }: { children: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`day-btn ${variant === "primary" ? "day-btn-ink" : "day-btn-soft"}`}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export interface AdminOption {
  id: string;
  username: string;
  isMe: boolean;
}

/**
 * Who can open the day site.
 *
 * Going public asks twice, like the old switch did: it changes what every
 * visitor to mmrchtu.tech sees.
 */
export function AudienceForm({
  audience,
  viewerIds,
  admins,
}: {
  audience: DayAudience;
  viewerIds: string[];
  admins: AdminOption[];
}) {
  const [state, action] = useFormState(setAudience, EMPTY_STATE);
  const [choice, setChoice] = useState<DayAudience>(audience);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const goingPublic = choice === "PUBLIC" && audience !== "PUBLIC";

  return (
    <div className="space-y-4">
      <form action={action}>
        <input type="hidden" name="onlyMe" value="yes" />
        <input type="hidden" name="audience" value="PRIVATE" />
        <div className="flex flex-wrap items-center gap-3 rounded-[4px] bg-day-gold/10 p-4 ring-1 ring-day-gold/40">
          <p className="min-w-0 flex-1 text-sm text-day-ink">
            <strong>Only me.</strong> Lock the day site to your account alone while you build it.
          </p>
          <SubmitButton>Only me</SubmitButton>
        </div>
      </form>

      <form action={action} className="space-y-4">
        <fieldset>
          <legend className="day-label">Or choose who can open it</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {DAY_AUDIENCES.map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-[4px] border p-4 text-sm transition-colors ${
                  choice === value ? "border-day-ink bg-day-ink text-day-on-ink" : "border-day-line/15 bg-day-surface text-day-ink hover:border-day-line/30"
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  value={value}
                  checked={choice === value}
                  onChange={() => {
                    setChoice(value);
                    setConfirmPublic(false);
                  }}
                  className="sr-only"
                />
                <span className="block font-semibold">{DAY_AUDIENCE_LABELS[value]}</span>
                <span className="mt-1 block text-xs opacity-70">{DAY_AUDIENCE_HINTS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {choice === "PRIVATE" ? (
          <fieldset>
            <legend className="day-label">Admins who can open it</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {admins.map((admin) => (
                <label
                  key={admin.id}
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] border border-day-line/15 bg-day-surface px-3.5 py-2 text-sm text-day-ink"
                >
                  <input
                    type="checkbox"
                    name="viewerIds"
                    value={admin.id}
                    defaultChecked={viewerIds.includes(admin.id)}
                    className="h-4 w-4"
                  />
                  {admin.username}
                  {admin.isMe ? <span className="text-xs text-day-faint">(you)</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {goingPublic ? (
          <label className="flex items-start gap-2 rounded-[4px] bg-day-live/[0.06] p-4 text-sm text-day-ink ring-1 ring-day-live/30">
            <input
              type="checkbox"
              checked={confirmPublic}
              onChange={(event) => setConfirmPublic(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            Yes, open it to everyone. mmrchtu.tech will open on the day site, and Register and Rules
            will be hidden until I change this back.
          </label>
        ) : null}

        <button type="submit" disabled={goingPublic && !confirmPublic} className="day-btn day-btn-ink">
          Save who can open it
        </button>
      </form>
      <Notice state={state} />
    </div>
  );
}
