"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { parseSlotLines } from "@/lib/day-slots";
import { saveRunningOrder, type RunningOrderState } from "./actions";

const EMPTY: RunningOrderState = { ok: false, message: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save the running order"}
    </Button>
  );
}

/**
 * The running order as one text box, a line an item, with the list it will
 * become drawn beside it as you type. Paste the whole day in from a document
 * or a spreadsheet and fix whichever lines turn red.
 */
export function RunningOrderForm({ initial }: { initial: string }) {
  const [state, action] = useFormState(saveRunningOrder, EMPTY);
  const [text, setText] = useState(initial);
  const { slots, bad } = useMemo(() => parseSlotLines(text), [text]);

  return (
    <form action={action} className="mt-3 grid gap-4 lg:grid-cols-2">
      <div>
        <label htmlFor="running-order" className="block text-xs font-medium text-ras-gray dark:text-white/70">
          One line each: start - end | title | place | detail
        </label>
        <textarea
          id="running-order"
          name="lines"
          rows={14}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"08:00 - 09:00 | Check-in | Main hall | Bring your robot and university ID\n09:00 | Check-in closes, running order drawn\n09:30 - 12:30 | Phase 1: Qualifying | Maze A\n12:30 - 13:15 | Lunch\n13:30 | Round of 32 | Mazes A and B"}
          className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] leading-relaxed text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
        />
        {bad.length ? (
          <p className="mt-1 text-xs font-semibold text-accent">
            Line{bad.length === 1 ? "" : "s"} {bad.join(", ")}: start with a time, like 09:30.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ras-gray dark:text-white/55">Times are Amman time on the day set above. A line without an end runs until the next one.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SaveButton />
          {state.message ? (
            <p role="status" className={`text-sm ${state.ok ? "text-ras-purple dark:text-white" : "text-accent"}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-ras-gray dark:text-white/70">What the day site will show</p>
        <ol className="mt-1 space-y-1.5 rounded-md border border-ras-gray/20 p-3 dark:border-white/10">
          {slots.map((slot, index) => (
            <li key={index} className="flex gap-3 text-sm">
              <span className="w-24 shrink-0 font-mono text-ras-gray dark:text-white/60">
                {slot.startTime}
                {slot.endTime ? `–${slot.endTime}` : ""}
              </span>
              <span>
                <span className="font-semibold text-ras-purple dark:text-white">{slot.title}</span>
                {slot.location ? <span className="text-ras-gray dark:text-white/60"> · {slot.location}</span> : null}
                {slot.detail ? <span className="block text-xs text-ras-gray dark:text-white/55">{slot.detail}</span> : null}
              </span>
            </li>
          ))}
          {slots.length === 0 ? <li className="text-sm text-ras-gray dark:text-white/55">Nothing yet.</li> : null}
        </ol>
      </div>
    </form>
  );
}
