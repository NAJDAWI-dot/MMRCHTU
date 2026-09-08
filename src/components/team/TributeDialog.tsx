"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { MouseMark } from "@/components/brand/MouseMark";
import { initials, stageFor } from "@/lib/roster";
import type { TributePerson } from "./TributeStage";

/**
 * One person, lit, with what they did written under them.
 *
 * Built as a stage rather than a card, and the difference is the whole design:
 * a pool of light, a beam coming down into it, dust drifting through the beam,
 * and the person standing in the middle of it. The words arrive a beat after
 * the panel does, so the tribute reads as something being said rather than
 * something that was already lying there.
 *
 * Portalled to document.body, and that is not a preference. The Team page sits
 * inside PageTransition's .page-enter, which animates transform — and an
 * element with a transform animation is a containing block for its
 * fixed-position descendants. CheddarCelebration records the measurement from
 * the last time this was got wrong: the overlay came out 69px down the page and
 * 1767px tall instead of covering the screen.
 *
 * The panel is dark in both site themes. A spotlight only reads against dark,
 * so this does not invert with the theme — and holding it dark is also what
 * makes the text safe over an uploaded backdrop, since the scrim below is then
 * one fixed ramp rather than one that has to be heavy enough in the light theme
 * without swamping the dark one.
 */

/** Everything the Tab trap treats as a stop. */
const FOCUSABLE = "button, a[href]";

/**
 * Dust in the beam.
 *
 * Written down rather than randomised so the drift is the same on the server as
 * in the browser and the same on every open — a specked pattern that reshuffles
 * each time reads as noise, and this is meant to read as air. Positions are
 * clustered toward the middle, where the light actually is.
 */
const MOTES = [
  { left: 46, bottom: 16, size: 2.5, dur: 11, delay: 0, drift: 10 },
  { left: 54, bottom: 24, size: 1.5, dur: 14, delay: 1.6, drift: -8 },
  { left: 38, bottom: 12, size: 2, dur: 12.5, delay: 3.1, drift: 14 },
  { left: 62, bottom: 20, size: 1.5, dur: 15, delay: 0.8, drift: -12 },
  { left: 50, bottom: 30, size: 3, dur: 13, delay: 4.4, drift: 6 },
  { left: 31, bottom: 18, size: 1.5, dur: 16, delay: 2.2, drift: 16 },
  { left: 69, bottom: 14, size: 2, dur: 12, delay: 5.6, drift: -14 },
  { left: 44, bottom: 34, size: 1.5, dur: 17, delay: 6.9, drift: 9 },
  { left: 58, bottom: 38, size: 2, dur: 13.5, delay: 3.8, drift: -6 },
  { left: 35, bottom: 26, size: 1.5, dur: 15.5, delay: 7.5, drift: 12 },
  { left: 65, bottom: 32, size: 2.5, dur: 14.5, delay: 1.1, drift: -10 },
  { left: 27, bottom: 36, size: 1.5, dur: 18, delay: 5.1, drift: 18 },
];

export function TributeDialog({
  person,
  position,
  total,
  previousName,
  nextName,
  onClose,
  onStep,
}: {
  person: TributePerson;
  position: number;
  total: number;
  previousName: string;
  nextName: string;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Re-runs when the arrows change person, because the panel is keyed by id and
  // is therefore a new element each time. `mounted` is in here too: on the
  // first pass there is no panel yet to focus.
  useEffect(() => {
    panelRef.current?.focus();
  }, [person.id, mounted]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onStep(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onStep(-1);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // Focus can be outside the panel entirely — the browser drops it on the
      // document when the keyed panel is replaced — and then neither of the
      // edge cases below is true and Tab would walk off into the page behind.
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onStep]);

  if (!mounted) return null;

  const stage = stageFor(person.id);
  const headingId = `tribute-name-${person.id}`;
  const composed = !person.stageUrl;

  const panelStyle = {
    backgroundColor: stage.ground,
    "--spot-strong": `${stage.glow}8C`,
    "--spot-soft": `${stage.glow}40`,
  } as CSSProperties;

  const portrait = person.photoUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element -- blob-stored portrait, downscaled at upload */
    <img
      src={person.photoUrl}
      alt=""
      width={120}
      height={120}
      className="block h-[120px] w-[120px] rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid h-[120px] w-[120px] place-items-center rounded-full bg-black/55 font-display text-4xl font-extrabold tracking-wide text-white backdrop-blur-sm"
    >
      {initials(person.name)}
    </span>
  );

  const overlay = (
    <div
      className="tribute-dim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      // onMouseDown, not onClick: a drag that starts on the tribute text and is
      // released on the backdrop is a selection, not a dismissal.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        key={person.id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        style={panelStyle}
        className="tribute-panel tribute-rise relative my-auto w-full max-w-[33rem] overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/15 focus:outline-none"
      >
        {person.stageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- blob-stored stage, downscaled at upload */
          <img
            src={person.stageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {/* The pool of light they stand in — their own colour, over their own
            picture if they have one, and the whole stage if they do not. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 78% 58% at 50% 24%, ${stage.glow}D9 0%, ${stage.glow}59 42%, transparent 74%)`,
          }}
        />

        {/*
          The beam and the dust in it, for a stage this file composed only.

          Both sit under the scrim, so neither can affect the contrast of a
          single word — and a picture somebody uploaded is lit however it was
          lit when it was taken. Painting a fake shaft of light down the front of
          a real photograph would look like exactly what it is.
        */}
        {composed ? (
          <>
            <div aria-hidden="true" className="tribute-beam absolute inset-0" />
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
              {MOTES.map((mote, index) => (
                <span
                  key={index}
                  className="tribute-mote"
                  style={
                    {
                      left: `${mote.left}%`,
                      bottom: `${mote.bottom}%`,
                      width: `${mote.size}px`,
                      height: `${mote.size}px`,
                      "--mote-dur": `${mote.dur}s`,
                      "--mote-delay": `${mote.delay}s`,
                      "--mote-drift": `${mote.drift}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </>
        ) : null}

        {/* The scrim. Heavier over an uploaded picture, because that picture is
            whatever somebody chooses next year and could be white; lighter over
            a stage this file composed, whose colours are known and are pinned
            dark by a test. Both ramps live in globals.css with the arithmetic. */}
        <div
          aria-hidden="true"
          className={`tribute-scrim absolute inset-0 ${composed ? "" : "tribute-scrim--photo"}`}
        />

        {/* Corners fall away, so the eye is pushed to the middle of the stage. */}
        <div aria-hidden="true" className="tribute-vignette absolute inset-0" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white/75 ring-1 ring-white/20 transition hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="tribute-reveal relative z-10 px-6 pb-8 pt-10 text-center sm:px-10 sm:pt-12">
          <p className="flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.34em] text-white/85">
            <span aria-hidden="true" className="h-px w-6 bg-white/35" />
            Honourable mention
            <span aria-hidden="true" className="h-px w-6 bg-white/35" />
          </p>

          <div className="mt-7 flex justify-center">
            <span className="relative grid h-[136px] w-[136px] place-items-center">
              {/* A rim of light turning slowly around them. The portrait covers
                  the middle, so only the 8px edge of this is ever seen. */}
              <span aria-hidden="true" className="tribute-ring absolute inset-0 rounded-full" />
              <span className="tribute-spot relative grid place-items-center rounded-full">
                {portrait}
              </span>
            </span>
          </div>

          <h2
            id={headingId}
            className="mt-7 text-balance font-display text-[26px] font-extrabold leading-tight tracking-[-0.015em] text-white sm:text-[30px]"
          >
            {person.name}
          </h2>

          <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/85">
            {person.role}
            {person.department ? (
              <>
                <span aria-hidden="true" className="mx-2 text-white/30">
                  ·
                </span>
                <span className="text-white/65">{person.department}</span>
              </>
            ) : null}
          </p>

          <p className="mx-auto mt-7 max-w-[26rem] text-pretty text-[17px] leading-[1.65] text-white/95">
            {person.tribute}
          </p>

          <div aria-hidden="true" className="mt-7 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-white/30" />
            <MouseMark className="h-5 w-5 text-white/60" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-white/30" />
          </div>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">
            With thanks — MMRC 26
          </p>

          {total > 1 ? (
            <div className="mt-7 flex items-center justify-center gap-5 border-t border-white/12 pt-5">
              <NavButton
                label={`Previous person: ${previousName}`}
                onClick={() => onStep(-1)}
                back
              />
              <span className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-white/75">
                {position} of {total}
              </span>
              <NavButton label={`Next person: ${nextName}`} onClick={() => onStep(1)} />
            </div>
          ) : null}

          {total > 1 ? (
            <p className="mt-3.5 hidden font-mono text-[9px] uppercase tracking-[0.2em] text-white/45 sm:block">
              ← → to move through the committee
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function NavButton({
  label,
  onClick,
  back,
}: {
  label: string;
  onClick: () => void;
  back?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-full text-white/70 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}
