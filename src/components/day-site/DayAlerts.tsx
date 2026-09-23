"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALERT_TONE_LABELS,
  bannerAlerts,
  dismiss,
  parseDismissed,
  pendingAlerts,
  type DayAlert,
  type Dismissed,
} from "@/lib/day-alerts";

const STORAGE_KEY = "mmrc26-day-alerts";

const TONE_DOT: Record<DayAlert["tone"], string> = {
  INFO: "bg-day-plum",
  URGENT: "bg-day-live",
  GOOD: "bg-day-good",
};

const TONE_TEXT: Record<DayAlert["tone"], string> = {
  INFO: "text-day-plum",
  URGENT: "text-day-live",
  GOOD: "text-day-good",
};

function Icon({ tone }: { tone: DayAlert["tone"] }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
        tone === "URGENT" ? "bg-day-live/10 text-day-live" : tone === "GOOD" ? "bg-day-good/10 text-day-good" : "bg-day-plum/10 text-day-plum"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tone === "GOOD" ? (
          <path d="M20 6 9 17l-5-5" />
        ) : tone === "URGENT" ? (
          <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17h.01" />
          </>
        ) : (
          <>
            <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * Announcements marked as alerts: a pop-up first, then the banner.
 *
 * Until the stored dismissals have been read there is nothing to show, so a
 * visitor who closed an alert yesterday is never flashed it again on load.
 * The banner cannot be closed by visitors: it goes when an admin clears the
 * alert, and a new edit brings the pop-up back.
 */
export function DayAlerts({ alerts }: { alerts: DayAlert[] }) {
  const [dismissed, setDismissed] = useState<Dismissed | null>(null);
  const [reopened, setReopened] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage refused: every alert pops up once per page load. Acceptable.
    }
    setDismissed(parseDismissed(stored));
  }, []);

  const pending = useMemo(() => (dismissed ? pendingAlerts(alerts, dismissed) : []), [alerts, dismissed]);
  const banner = useMemo(() => (dismissed ? bannerAlerts(alerts, dismissed) : []), [alerts, dismissed]);
  const open = reopened ? (alerts.find((alert) => alert.id === reopened) ?? null) : (pending[0] ?? null);

  const close = useCallback(() => {
    if (!open || !dismissed) return;
    const next = dismiss(dismissed, open, alerts);
    setDismissed(next);
    setReopened(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // As above.
    }
  }, [open, dismissed, alerts]);

  useEffect(() => {
    if (!open) return;
    // Without preventScroll the browser scrolls the page to "show" a button
    // that is already on screen in a fixed dialog, and the visitor loses their place.
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Long lines scroll slower, so every banner reads at the same pace.
  const letters = banner.reduce((sum, alert) => sum + alert.title.length + alert.body.length, 0);
  const marquee = `${Math.max(24, Math.round(letters * 0.28))}s`;

  return (
    <>
      {banner.length ? (
        <div className="day-banner-in relative z-50 border-b border-day-line/10 bg-day-ink text-day-on-ink">
          <div className="day-banner overflow-hidden" style={{ ["--day-marquee" as string]: marquee }}>
            <div className="day-banner-track">
              {[0, 1].map((copy) => (
                <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 ? "true" : undefined}>
                  {banner.map((alert) => (
                    <li key={`${copy}-${alert.id}`}>
                      <button
                        type="button"
                        tabIndex={copy === 1 ? -1 : 0}
                        onClick={() => setReopened(alert.id)}
                        className="flex items-center gap-2.5 whitespace-nowrap px-6 py-1.5 text-[13px] font-medium hover:underline"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[alert.tone]}`} aria-hidden="true" />
                        {alert.title ? <span className="font-bold">{alert.title}</span> : null}
                        <span className="opacity-85">{alert.body.replace(/\s+/g, " ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-end p-3 sm:place-items-center sm:p-6" role="presentation">
          <button type="button" aria-label="Close" tabIndex={-1} className="day-dialog-backdrop absolute inset-0" onClick={close} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="day-alert-title"
            aria-describedby="day-alert-body"
            className="day-dialog day-card relative w-full max-w-lg overflow-hidden p-6 sm:p-7"
            data-lenis-prevent
          >
            <div className="day-stripe-x absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
            <div className="flex items-start gap-4">
              <Icon tone={open.tone} />
              <div className="min-w-0 flex-1">
                <p className={`day-kicker ${TONE_TEXT[open.tone]}`}>
                  {ALERT_TONE_LABELS[open.tone]}
                  {!reopened && pending.length > 1 ? ` · 1 of ${pending.length}` : ""}
                </p>
                <h2 id="day-alert-title" className="day-display mt-2 text-2xl text-day-ink sm:text-[1.75rem]">
                  {open.title || (open.tone === "URGENT" ? "Heads up" : "From the organisers")}
                </h2>
                <p id="day-alert-body" className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-day-muted">
                  {open.body}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-xs text-day-faint">It stays in the bar at the top of the page.</p>
              <button ref={closeRef} type="button" onClick={close} className="day-btn day-btn-ink">
                {!reopened && pending.length > 1 ? "Next" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
