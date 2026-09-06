"use client";

import { useEffect } from "react";

/**
 * Keyboard shortcuts for the payment review queue.
 *
 * The queue exists to make checking forty payments a short pass rather than an
 * afternoon, and reaching for the mouse three times per team is most of what
 * makes it long. V verifies, S skips.
 *
 * R deliberately only *focuses* the reason box rather than submitting: a
 * rejection cannot be made without a reason — the team is shown it — so there
 * is nothing for a one-key reject to do except fail.
 *
 * Renders nothing. It attaches to elements the page owns by id, so the markup
 * stays plain server-rendered HTML that works with no JavaScript at all; this
 * only makes it faster.
 */

const IDS = {
  verify: "review-verify",
  note: "review-note",
  skip: "review-skip",
} as const;

export function ReviewShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Never steal a browser or OS chord.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Not while someone is writing. Typing "very short reference" into the
      // reason box must not fire V, and this is the bug that makes naive
      // single-key shortcuts unusable.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(input|textarea|select|button)$/i.test(target.tagName))
      ) {
        return;
      }

      const action = { v: IDS.verify, r: IDS.note, s: IDS.skip }[event.key.toLowerCase()];
      if (!action) return;

      const node = document.getElementById(action);
      if (!node) return;

      event.preventDefault();
      if (action === IDS.note) {
        node.focus();
        node.scrollIntoView({ block: "nearest" });
      } else {
        node.click();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
