"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { initials, stageFor } from "@/lib/roster";
import type { TributePerson } from "./TributeStage";

/**
 * One person, lit, with what they did written under them.
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

export function TributeDialog({
  person,
  position,
  total,
  onClose,
  onStep,
}: {
  person: TributePerson;
  position: number;
  total: number;
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
      className="block h-[120px] w-[120px] rounded-full object-cover ring-2 ring-white/45"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid h-[120px] w-[120px] place-items-center rounded-full bg-black/55 font-display text-4xl font-extrabold text-white ring-2 ring-white/45 backdrop-blur-sm"
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
        className="tribute-rise relative my-auto w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/15 focus:outline-none"
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

        {/* The scrim. Heavier over an uploaded picture, because that picture is
            whatever somebody chooses next year and could be white; lighter over
            a stage this file composed, whose colours are known and are pinned
            dark by a test. Both ramps live in globals.css with the arithmetic. */}
        <div
          aria-hidden="true"
          className={`tribute-scrim absolute inset-0 ${person.stageUrl ? "tribute-scrim--photo" : ""}`}
        />

        <div className="relative px-6 pb-7 pt-10 text-center sm:px-10">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white/80 ring-1 ring-white/25 transition hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
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

          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/70">
            Honourable mention
          </p>

          <div className="mt-5 flex justify-center">
            <span className="tribute-spot inline-block rounded-full">{portrait}</span>
          </div>

          <h2
            id={headingId}
            className="mt-6 text-balance font-display text-2xl font-extrabold text-white sm:text-3xl"
          >
            {person.name}
          </h2>
          <p className="mt-1.5 text-sm font-semibold uppercase tracking-wider text-white/85">
            {person.department ? `${person.role} · ${person.department}` : person.role}
          </p>

          <p className="tribute-line mx-auto mt-6 max-w-sm text-pretty text-[15px] leading-relaxed text-white/95">
            {person.tribute}
          </p>

          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            The MMRC 26 Committee
          </p>

          {total > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-4 border-t border-white/15 pt-5">
              <NavButton label="Previous person" onClick={() => onStep(-1)} back />
              <span className="font-mono text-xs tabular-nums text-white/70">
                {position} of {total}
              </span>
              <NavButton label="Next person" onClick={() => onStep(1)} />
            </div>
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
      className="grid h-10 w-10 place-items-center rounded-full text-white/75 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
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
