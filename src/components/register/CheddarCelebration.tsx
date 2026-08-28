"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Cheddar } from "@/components/brand/Cheddar";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";
import { CELEBRATION_FADE_MS, pickCelebration, type Celebration } from "@/lib/celebration";

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
  /**
   * Falls back to the drawn Cheddar when a portrait will not load.
   *
   * The drawings live in public/ and are fetched at the moment the overlay
   * appears, so a bad deploy or a dropped connection would otherwise leave a
   * hole where the mouse should be — in the middle of the one screen that is
   * meant to feel like a reward. Cheddar.tsx is inline SVG and cannot fail.
   */
  const [portraitFailed, setPortraitFailed] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const timersRef = useRef<number[]>([]);

  /**
   * Shown whenever a registration completes, with nothing remembered between
   * times.
   *
   * There used to be a `mmrc26.cheddar.seen` flag in localStorage, written when
   * this mounted. It was a mistake twice over. Writing it on mount rather than
   * on dismissal meant anything that mounted the component once — an earlier
   * build, a half-finished attempt — suppressed him permanently, with no way
   * for the person to ever get him back and no way for us to reproduce it. And
   * "once per browser" was the wrong grain anyway: this is the end of a
   * registration, a team does exactly one of those, and a shared university
   * machine should not swallow the second team's turn because the first team
   * sat at it.
   *
   * So there is no flag. He appears when a registration is completed, which is
   * once per team by construction. A refresh of the confirmation does not bring
   * him back either, because the form's success state does not survive one.
   */
  useEffect(() => {
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
          {/*
            One of five hand-drawn variations, so a team that registers beside
            another does not see the same mouse.

            A plain <img> rather than next/image: these are SVGs, which the
            optimiser passes through untouched anyway, and the drawing is
            decorative enough that a layout-shift-preventing wrapper would be
            more machinery than it earns. The falls-back-to-the-drawn-Cheddar
            branch is what makes that safe — a file that fails to load leaves a
            mouse behind rather than a gap in the middle of the celebration.
          */}
          {portraitFailed ? (
            <Cheddar size={168} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- decorative SVG, no optimisation to gain
            <img
              src={celebration.portrait.src}
              alt={celebration.portrait.alt}
              // Square, matching the CSS box. The drawings are not square and
              // are not stretched to fit it — object-fit does the letterboxing.
              width={200}
              height={200}
              onError={() => setPortraitFailed(true)}
              className="cheddar-portrait"
            />
          )}
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
