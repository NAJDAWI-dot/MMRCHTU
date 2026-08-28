"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CHEDDAR_PORTRAITS } from "@/lib/celebration";
import {
  AMBIENT_INTERVAL_MS,
  CHASE_DURATION_MS,
  FIRST_CHASE_DELAY_MS,
  FIRST_PEEK_DELAY_MS,
  PEEK_DURATION_MS,
  pickChase,
  pickPeek,
  type AmbientChase,
  type AmbientPeek,
} from "@/lib/ambient-mice";

/**
 * Mice wandering across the site.
 *
 * One peeks in from an edge; another runs along the bottom after a piece of
 * cheese. Each on its own timer, offset so they do not arrive together.
 *
 * Mounted in the root layout, so they are on every page and — because that is
 * outside PageTransition — they are not torn down and restarted by a
 * navigation. The cadence belongs to the visitor rather than to the page they
 * happen to be looking at.
 *
 * Decoration in the strict sense, and treated as such throughout: the whole
 * layer is aria-hidden and pointer-events: none, so it is invisible to a screen
 * reader and cannot intercept a click meant for the page underneath. Nothing on
 * the page depends on it and nothing is lost if it never runs.
 *
 * Which is the point of the three ways it declines to run. Under
 * prefers-reduced-motion it renders nothing at all — an animal darting across
 * the screen every half minute is exactly what that setting is asked for. While
 * the tab is hidden the timers keep their cadence but skip the appearance, so a
 * background tab is not decoding images nobody is looking at. And nothing is
 * requested until the first appearance is due, so a visitor who reads the hero
 * and clicks Register pays for none of it.
 */

/** Cheddar's cheese: a wedge, drawn here rather than fetched. */
function Cheese({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true" focusable="false">
      {/* Top face, then the front, so the holes can sit on the front alone. */}
      <path d="M4 14 L30 2 L46 12 L44 16 L6 18 Z" fill="#f2c14e" />
      <path d="M4 14 L44 16 L44 30 Q24 38 4 30 Z" fill="#e0a92e" />
      <path d="M4 14 L30 2 L46 12 L44 16 L6 18 Z" fill="none" stroke="#8a6512" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 14 L44 16 L44 30 Q24 38 4 30 Z" fill="none" stroke="#8a6512" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="15" cy="25" r="3.2" fill="#c8901f" />
      <circle cx="30" cy="27" r="2.4" fill="#c8901f" />
      <circle cx="38" cy="22" r="1.8" fill="#c8901f" />
    </svg>
  );
}

export function AmbientMice() {
  /**
   * Null until the first effect has run, which is what keeps this out of the
   * server's markup. The choices are random, so rendering during SSR would
   * hand the browser a mouse in one corner and then hydrate a different one
   * into another — the same reason Countdown and CheddarCelebration both wait.
   */
  const [enabled, setEnabled] = useState(false);
  const [peek, setPeek] = useState<AmbientPeek | null>(null);
  const [chase, setChase] = useState<AmbientChase | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    setEnabled(true);

    // Honoured while the page is open, not only at load: someone who turns the
    // setting on should not have to reload to be left alone.
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      setEnabled(!event.matches);
      if (event.matches) {
        setPeek(null);
        setChase(null);
      }
    };
    reduced.addEventListener("change", onPreferenceChange);
    return () => reduced.removeEventListener("change", onPreferenceChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timers: number[] = [];

    /**
     * Schedules one appearance and the next tick after it.
     *
     * A chain of timeouts rather than setInterval, so the clear-out below can
     * only ever leave nothing running — and so the "put it away again" timer is
     * owned by the same code that put it up.
     */
    const run = <T,>(
      choose: (previous: T | null) => T,
      show: (value: T | null) => void,
      visibleMs: number,
      firstDelay: number,
    ) => {
      let previous: T | null = null;

      const tick = () => {
        // The cadence is kept but the appearance is skipped: a hidden tab
        // should not be decoding an image, and coming back to a mouse frozen
        // mid-slide from ten minutes ago would be worse than missing it.
        if (!document.hidden) {
          previous = choose(previous);
          show(previous);
          timers.push(window.setTimeout(() => show(null), visibleMs));
        }
        timers.push(window.setTimeout(tick, AMBIENT_INTERVAL_MS));
      };

      timers.push(window.setTimeout(tick, firstDelay));
    };

    run<AmbientPeek>((p) => pickPeek(Math.random, p), setPeek, PEEK_DURATION_MS, FIRST_PEEK_DELAY_MS);
    run<AmbientChase>(
      (p) => pickChase(Math.random, p),
      setChase,
      CHASE_DURATION_MS,
      FIRST_CHASE_DELAY_MS,
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      setPeek(null);
      setChase(null);
    };
  }, [enabled]);

  if (!enabled) return null;

  /*
    Portalled to the body, and it has to be — the same trap CheddarCelebration
    documents.

    This renders from inside the homepage, which sits inside PageTransition's
    `.page-enter`, and that element animates `transform` with fill-mode both. An
    element with a transform applied is a containing block for fixed-position
    descendants, so `position: fixed` here resolves against the page wrapper
    rather than the viewport. Measured before this was added, the chase ran
    across the middle of the page instead of along the bottom of the screen.

    Safe to reach for document.body unguarded: nothing renders until the effect
    above has set `enabled`, so this only ever runs in the browser.
  */
  return createPortal(
    <div className="ambient-mice" aria-hidden="true">
      {peek ? (
        // Keyed on the spot and the drawing so React replaces the element
        // rather than reusing it, which is what restarts the CSS animation —
        // without it the second mouse would appear already halfway through.
        <div
          key={`peek-${peek.spot}-${peek.portrait}`}
          className={`ambient-peek ambient-peek--${peek.spot}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size, no optimisation to gain */}
          <img
            src={CHEDDAR_PORTRAITS[peek.portrait]!.src}
            alt=""
            width={200}
            height={200}
            className="ambient-mouse"
          />
        </div>
      ) : null}

      {chase ? (
        <div
          key={`chase-${chase.direction}-${chase.portrait}`}
          className={`ambient-chase ambient-chase--${chase.direction}`}
        >
          <Cheese className="ambient-cheese" />
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size, no optimisation to gain */}
          <img
            src={CHEDDAR_PORTRAITS[chase.portrait]!.src}
            alt=""
            width={200}
            height={200}
            className="ambient-mouse ambient-mouse--chasing"
          />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
