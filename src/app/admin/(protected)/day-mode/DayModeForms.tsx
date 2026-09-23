"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { DAY_AUDIENCES, DAY_AUDIENCE_HINTS, DAY_AUDIENCE_LABELS, type DayAudience } from "@/lib/day-audience";
import { setAudience } from "./actions";
import { EMPTY_STATE, type ActionState } from "./state";

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-sm ${
        state.ok ? "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white" : "bg-ras-crimson/10 text-accent"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ children, variant = "primary" }: { children: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#F2A900]/50 bg-[#F2A900]/10 p-3">
          <p className="min-w-0 flex-1 text-sm text-[var(--color-fg)]">
            <strong>Only me.</strong> Lock the day site to your account alone while you build it.
          </p>
          <SubmitButton>Only me</SubmitButton>
        </div>
      </form>

      <form action={action} className="space-y-4">
        <fieldset>
          <legend className="text-xs font-medium text-ras-gray dark:text-white/70">Or choose who can open it</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {DAY_AUDIENCES.map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border p-3 text-sm ${
                  choice === value
                    ? "border-ras-purple bg-ras-purple/10 dark:border-white/40 dark:bg-white/10"
                    : "border-ras-gray/20 dark:border-white/10"
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
                <span className="block font-semibold text-[var(--color-fg)]">{DAY_AUDIENCE_LABELS[value]}</span>
                <span className="mt-1 block text-xs text-ras-gray dark:text-white/60">{DAY_AUDIENCE_HINTS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {choice === "PRIVATE" ? (
          <fieldset>
            <legend className="text-xs font-medium text-ras-gray dark:text-white/70">Admins who can open it</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {admins.map((admin) => (
                <label
                  key={admin.id}
                  className="flex items-center gap-2 rounded-full border border-ras-gray/25 px-3 py-1.5 text-sm dark:border-white/15"
                >
                  <input
                    type="checkbox"
                    name="viewerIds"
                    value={admin.id}
                    defaultChecked={viewerIds.includes(admin.id)}
                    className="h-4 w-4"
                  />
                  {admin.username}
                  {admin.isMe ? <span className="text-xs text-ras-gray">(you)</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {goingPublic ? (
          <label className="flex items-start gap-2 rounded-lg border border-ras-crimson/40 bg-ras-crimson/5 p-3 text-sm">
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

        <Button type="submit" disabled={goingPublic && !confirmPublic}>
          Save who can open it
        </Button>
      </form>
      <Notice state={state} />
    </div>
  );
}
