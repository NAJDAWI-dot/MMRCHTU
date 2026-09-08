"use client";

import { useCallback, type ReactNode } from "react";

import { useTributeStage } from "./TributeStage";

/**
 * A committee card, made openable.
 *
 * Wraps the card's own markup instead of replacing it, so the three card
 * shapes on the Team page keep their layout and stay server-rendered — the
 * card arrives here as children, already built.
 *
 * When nothing has been written about somebody it renders a plain div and no
 * button at all. A card that looks clickable and opens an empty stage is worse
 * than a card that does nothing, and the page has always had cards that do
 * nothing, so the quiet version is the one that costs nobody anything.
 */
export function TributeTrigger({
  id,
  hasTribute,
  className,
  children,
}: {
  id: string;
  hasTribute: boolean;
  /** Carries the card's own layout, including its text alignment. */
  className: string;
  children: ReactNode;
}) {
  const { open, registerTrigger } = useTributeStage();

  const ref = useCallback(
    (element: HTMLButtonElement | null) => registerTrigger(id, element),
    [id, registerTrigger],
  );

  if (!hasTribute) return <div className={className}>{children}</div>;

  return (
    <button
      type="button"
      ref={ref}
      onClick={() => open(id)}
      aria-haspopup="dialog"
      className={`${className} cursor-pointer transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      {children}
      {/* The name and role are already read out; this says what the button does. */}
      <span className="sr-only"> — open their honourable mention</span>
    </button>
  );
}
