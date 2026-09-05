"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "@/lib/payment";
import { updatePaymentStatus } from "./actions";
import { EMPTY_STATE } from "./state";

/**
 * The full status control on one row of the payments list.
 *
 * A client component only so that a refused save can be shown on the row that
 * caused it. Setting a payment to "Not matched" with an empty note used to be
 * accepted silently, and the team then saw a refusal with no explanation on
 * their own registration page; now the action returns a message and it lands
 * here, beside the control, instead of throwing a server error across the
 * whole page.
 *
 * The fast path for the common decision is the separate one-click Verify
 * button rendered next to this — this control is for everything else.
 */

const FIELD =
  "rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending} className="px-2 py-1 text-xs">
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function PaymentRowForm({
  id,
  teamName,
  paymentStatus,
  paymentNote,
}: {
  id: string;
  teamName: string;
  paymentStatus: string;
  paymentNote: string | null;
}) {
  const [state, action] = useFormState(updatePaymentStatus, EMPTY_STATE);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />

      <select
        name="paymentStatus"
        defaultValue={paymentStatus}
        aria-label={`Payment status for ${teamName}`}
        className={FIELD}
      >
        {PAYMENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PAYMENT_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <input
        name="paymentNote"
        defaultValue={paymentNote ?? ""}
        placeholder="Note (e.g. why it did not match)"
        aria-label={`Payment note for ${teamName}`}
        className={`min-w-0 flex-1 ${FIELD}`}
      />

      <SubmitButton />

      {/* basis-full so the message drops onto its own line rather than
          squeezing the note field down to nothing when it appears. */}
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`basis-full text-xs ${
            state.ok ? "text-ras-gray dark:text-white/60" : "font-semibold text-accent"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
