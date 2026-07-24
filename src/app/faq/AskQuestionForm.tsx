"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitFaqQuestion, type AskQuestionActionState } from "@/app/faq/actions";
import { Button } from "@/components/ui/Button";

const initialState: AskQuestionActionState = { status: "idle" };

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";

export function AskQuestionForm() {
  const [state, formAction] = useFormState(submitFaqQuestion, initialState);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-md border border-ras-purple/30 bg-ras-purple/5 p-4 text-sm text-ras-purple dark:text-white"
      >
        Thanks — your question has been sent to the organizers.
      </div>
    );
  }

  return (
    <details className="rounded-lg border border-ras-gray/20 p-4">
      <summary className="cursor-pointer font-display font-bold text-ras-purple dark:text-white">
        Don&apos;t see your question? Ask us
      </summary>
      <form action={formAction} noValidate className="mt-4 space-y-3">
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-ras-gray dark:text-white/80">
            Your question
          </label>
          <textarea id="question" name="question" required rows={3} className={inputClass} />
          {state.errors?.question ? (
            <p role="alert" className="mt-1 text-sm text-ras-crimson">
              {state.errors.question}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="askerEmail" className="block text-sm font-medium text-ras-gray dark:text-white/80">
            Your email (optional, if you&apos;d like a direct reply)
          </label>
          <input id="askerEmail" name="askerEmail" type="email" className={inputClass} />
          {state.errors?.askerEmail ? (
            <p role="alert" className="mt-1 text-sm text-ras-crimson">
              {state.errors.askerEmail}
            </p>
          ) : null}
        </div>
        <SubmitButton />
      </form>
    </details>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send question"}
    </Button>
  );
}
