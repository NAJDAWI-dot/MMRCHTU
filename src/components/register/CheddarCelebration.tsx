"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Cheddar } from "@/components/brand/Cheddar";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";
import {
  CELEBRATION_FADE_MS,
  CELEBRATION_SEEN_KEY,
  pickCelebration,
  type Celebration,
} from "@/lib/celebration";

interface CheddarCelebrationProps {
  /**
   * Injected by the tests so a run can ask for a particular quip. Production
   * leaves it alone.
   */
  random?: () => number;
}

/**
 * Cheddar's one appearance, when a team finishes registering.
 *
 * He comes up over the confirmation rather than instead of it. The panel
 * underneath carries the six-character reference, which is the single thing a
 * team must not miss, so nothing here may hold it hostage: a click anywhere,
 * Escape, the button, or simply waiting all put him away.
 *
 * Whether he appears at all is decided after mount, not during render — the
 * answer lives in localStorage, and reading it while rendering would make the
 * server's markup and the browser's first pass disagree. Same reason the draft
 * restore in RegisterForm waits for an effect.
 */
export function CheddarCelebration({ random = Math.random }: CheddarCelebrationProps) {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [leaving, setLeaving] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(CELEBRATION_SEEN_KEY) === "1";
    } catch {
      // Private modes refuse storage. Worst case he shows up twice, which is
      // not a reason to let anything throw on a confirmation screen.
    }
    if (seen) return;

    // Recorded on the way in rather than on dismissal: someone who closes the
    // tab mid-joke has still met him, and should get their confirmation
    // uninterrupted next time.
    try {
      window.localStorage.setItem(CELEBRATION_SEEN_KEY, "1");
    } catch {
      // As above.
    }
    setCelebration(pickCelebration(random));
  }, [random]);

  const dismiss = useCallback(() => {
    setLeaving(true);
    timersRef.current.push(
      window.setTimeout(() => setCelebration(null), CELEBRATION_FADE_MS),
    );
  }, []);

  useEffect(() => {
    if (!celebration) return;

    dismissRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [celebration, dismiss]);

  if (!celebration) return null;

  /**
   * Portalled to the body, and it has to be.
   *
   * This is rendered from inside the register form, which sits inside
   * PageTransition's `.page-enter` — and that element animates `transform` with
   * `fill-mode: both`. An element with a transform animation applied is a
   * containing block for fixed-position descendants, so `position: fixed` here
   * resolves against the page wrapper rather than the viewport: measured, the
   * overlay came out 69px down and 1767px tall instead of covering the screen.
   * The dim would have started below the header and scrolled with the page.
   *
   * Safe to reach for `document.body` unguarded: nothing renders until the
   * effect above has run, so this only ever executes in the browser.
   */
  return createPortal(
    <div
      className={`cheddar-celebration${leaving ? " cheddar-celebration-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheddar-heading"
      // No click-anywhere dismissal any more: this panel now carries the only
      // on-screen statement of what happens next, and a stray click on the way
      // to a button should not take it away mid-sentence.
    >
      <div className="cheddar-celebration-stage">
        <p className="cheddar-bubble">{celebration.quip}</p>

        <div className={`cheddar-actor cheddar-move-${celebration.move}`}>
          <Cheddar size={168} />
        </div>

        <div className="cheddar-card">
          <h2 id="cheddar-heading" className="cheddar-heading">
            Registration complete
          </h2>
          <p className="cheddar-note">
            We have your team and your payment. Checking the payment against our account takes{" "}
            <strong>{VERIFICATION_WINDOW_TEXT}</strong>, and we will email you the moment it is
            confirmed. There is nothing else you need to send.
          </p>

          <div className="cheddar-actions">
            <Link href="/" className="cheddar-action cheddar-action-primary">
              Back to the main page
            </Link>
            <button
              ref={dismissRef}
              type="button"
              onClick={dismiss}
              className="cheddar-action cheddar-action-secondary"
            >
              Stay here
            </button>
          </div>

          <p className="cheddar-hint">
            Staying shows your registration reference, which is also in your email.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
