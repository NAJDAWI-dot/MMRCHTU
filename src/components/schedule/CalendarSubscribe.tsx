"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Subscribe to the schedule, rather than download a copy of it.
 *
 * The per-event "Add to calendar" links beside each row hand over a snapshot,
 * and a snapshot is wrong the moment a time moves — the reader has no way of
 * knowing it happened. A subscription is fetched by their calendar app on a
 * loop, so a room change or a new heat reaches them without anyone being told
 * to download anything again.
 *
 * Both routes are offered because they fail in opposite directions: the
 * `webcal://` link is one tap on a phone and does nothing at all on a desktop
 * with no handler registered, while the copyable URL works everywhere and asks
 * the reader to find the "add by URL" box themselves.
 */

type CopyState = "idle" | "copied" | "failed";

export function CalendarSubscribe({ url }: { url: string }) {
  const [copied, setCopied] = useState<CopyState>("idle");

  // The confirmation is a status, not a permanent label — without this the
  // button reads "Copied" for the rest of the visit, long after it stopped
  // describing anything that just happened.
  useEffect(() => {
    if (copied === "idle") return;
    const timer = window.setTimeout(() => setCopied("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      // Absent on http origins and in a few older browsers, so its absence is
      // a normal outcome rather than an error worth logging.
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const webcal = url.replace(/^https?:/, "webcal:");

  return (
    <div className="mt-8 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-5">
      <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
        Keep this schedule in your calendar
      </p>
      <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
        Subscribe once and it stays current. If a time moves or a heat is added, your calendar
        picks it up on its own — no need to come back for a new file.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <a href={webcal}>Subscribe</a>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          Copy link
        </Button>
        <a
          href={url}
          className="inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-accent hover:underline"
        >
          Download once
        </a>
      </div>

      {/* Announced rather than only shown: the button's own label does not
          change, so a screen reader would otherwise get no feedback at all. */}
      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs text-ras-gray dark:text-white/60">
        {copied === "copied" ? "Link copied." : null}
        {copied === "failed" ? "Could not copy — select the address below instead." : null}
      </p>

      <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded-md bg-ras-purple/5 px-3 py-2 font-mono text-xs text-ras-gray dark:bg-white/5 dark:text-white/70">
        {url}
      </code>
    </div>
  );
}
