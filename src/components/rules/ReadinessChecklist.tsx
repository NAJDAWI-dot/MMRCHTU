"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  CHECKLIST,
  CHECKLIST_GROUPS,
  type ChecklistItem,
  checklistReport,
  checklistSummary,
  checklistVerdict,
} from "@/lib/rules";

/**
 * "Is our mouse allowed to compete?" answered before the team travels.
 *
 * Every item traces to a line in the rulebook — see `CHECKLIST`. The list keeps
 * disqualifying rules apart from advice, because a team that is legal but
 * unprepared needs to hear something different from a team that is neither.
 *
 * Answers persist locally so a team can work through it over a few weeks. It is
 * deliberately not stored on the server: nothing here is a submission, and a
 * checklist that quietly reported your unreadiness to the organisers is a
 * checklist people would fill in dishonestly.
 */

const STORAGE_KEY = "mmrc26-readiness";

export function ReadinessChecklist() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Read after mount, never during render: the server has no localStorage, so
  // seeding state from it would make the first client render disagree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        // Rebuilt from the current list rather than trusted wholesale, so a
        // stored answer for an item that has since been reworded or removed
        // cannot count towards today's total.
        const stored = parsed as Record<string, unknown>;
        const clean: Record<string, boolean> = {};
        for (const item of CHECKLIST) if (stored[item.id] === true) clean[item.id] = true;
        setAnswers(clean);
      }
    } catch {
      // Corrupt JSON, or storage blocked entirely. Starting fresh is a fine
      // outcome; failing to render the checklist is not.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Private browsing or a full quota. The checklist still works for this
      // sitting, which is the part that matters.
    }
  }, [answers, hydrated]);

  useEffect(() => {
    if (copied === "idle") return;
    const timer = window.setTimeout(() => setCopied("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const summary = checklistSummary(answers);
  const toggle = (id: string) => setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(checklistReport(answers));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="space-y-6">
      <ProgressSummary summary={summary} />

      {CHECKLIST_GROUPS.map((group) => {
        const items = CHECKLIST.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <section key={group} aria-labelledby={`group-${group.replace(/\s+/g, "-")}`}>
            <h2
              id={`group-${group.replace(/\s+/g, "-")}`}
              className="font-display text-lg font-bold text-ras-purple dark:text-white"
            >
              {group}
            </h2>
            <ul className="mt-2 divide-y divide-ras-gray/15 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)]">
              {items.map((item) => (
                <li key={item.id}>
                  <Row item={item} checked={Boolean(answers[item.id])} onToggle={toggle} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          className="min-h-[44px] transition-transform active:scale-95"
          onClick={copyReport}
        >
          {copied === "done"
            ? "Copied"
            : copied === "failed"
              ? "Could not copy"
              : "Copy as text"}
        </Button>
        <Button
          variant="ghost"
          className="min-h-[44px] transition-transform active:scale-95"
          onClick={() => {
            if (!confirmingReset) {
              setConfirmingReset(true);
              return;
            }
            setAnswers({});
            setConfirmingReset(false);
          }}
          onBlur={() => setConfirmingReset(false)}
          disabled={!summary.confirmed}
        >
          {confirmingReset ? "Tap again to clear" : "Clear"}
        </Button>
        <p className="text-sm text-ras-gray dark:text-white/60">
          Saved on this device only — nothing is sent to the organisers.
        </p>
      </div>
    </div>
  );
}

function ProgressSummary({ summary }: { summary: ReturnType<typeof checklistSummary> }) {
  const tone =
    summary.state === "ready"
      ? "border-ras-purple/40 bg-ras-purple/5 dark:bg-white/5"
      : summary.state === "blocked"
        ? "border-ras-crimson/40 bg-ras-crimson/5"
        : "border-ras-gray/20 bg-[var(--color-surface)]";

  return (
    <div className={`rounded-lg border p-4 transition-colors duration-300 sm:p-6 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
          {/* Announced as a whole so a screen reader gets the verdict with the
              number, not a bare percentage that changes on every tick. */}
          <span aria-live="polite">
            {summary.confirmed} of {summary.total} confirmed
          </span>
        </p>
        <p className="text-sm font-medium text-ras-gray dark:text-white/70">
          {checklistVerdict(summary)}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={summary.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Checklist progress"
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ras-gray/20"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
            summary.state === "blocked" ? "bg-ras-crimson" : "bg-ras-purple dark:bg-white"
          }`}
          style={{ width: `${summary.percent}%` }}
        />
      </div>

      {summary.state === "blocked" ? (
        // Genuinely mounting for the first time when it appears — unlike the
        // maze figures, this one needs no key trick to replay the entrance.
        <div className="figure-in mt-4">
          <p className="text-sm font-semibold text-ras-crimson dark:text-rose-300">
            Still to settle before you can compete:
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ras-gray dark:text-white/70">
            {summary.blockers.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.state === "ready" ? (
        <p className="figure-in mt-4 text-sm text-ras-gray dark:text-white/70">
          Nothing left to check.{" "}
          <Link href="/schedule" className="font-semibold text-ras-crimson hover:underline">
            Check the schedule
          </Link>{" "}
          for competition day.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 transition-colors hover:bg-ras-purple/5 sm:p-4 dark:hover:bg-white/5">
      {/* The label wraps the box and the text together, so the whole line is a
          target rather than the 18px square alone. */}
      <label className="flex min-h-[44px] flex-1 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item.id)}
          className="mt-0.5"
        />
        <span className="min-w-0">
          <span
            className={`block text-sm font-medium transition-colors duration-200 ${
              checked
                ? "text-ras-gray line-through dark:text-white/50"
                : "text-ras-purple dark:text-white"
            }`}
          >
            {item.label}
          </span>
          <span className="mt-0.5 block text-sm text-ras-gray dark:text-white/60">
            {item.detail}
          </span>
        </span>
      </label>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {item.severity === "advisory" ? (
          <span className="rounded-full bg-ras-gray/10 px-2 py-0.5 text-xs font-medium text-ras-gray dark:bg-white/10 dark:text-white/70">
            Advice
          </span>
        ) : (
          <span className="rounded-full bg-ras-crimson/10 px-2 py-0.5 text-xs font-medium text-ras-crimson dark:bg-rose-400/15 dark:text-rose-300">
            Rule
          </span>
        )}
        {item.help ? (
          <Link
            href={item.help.href}
            className="text-xs font-semibold text-ras-crimson hover:underline dark:text-rose-300"
          >
            {item.help.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
