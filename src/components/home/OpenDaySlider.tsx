"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/components/brand/Countdown";
import { MouseMark } from "@/components/brand/MouseMark";
import { OPEN_DAY_END_SUBJECT, OPEN_DAY_SUBJECT } from "@/lib/countdown";
import {
  SLIDE_INTERVAL_MS,
  nextOpenDayBoundary,
  nextSlideIndex,
  openDayClock,
  openDayDateLabel,
  openDayPhase,
  openDaySlides,
  type OpenDayPhase,
  type OpenDaySlide,
} from "@/lib/open-day";

/**
 * The open day band across the top of the homepage.
 *
 * The homepage belongs to the competition, which is months away. The open day
 * is a stand in a hall on one afternoon, and by the time somebody scrolled far
 * enough to find a card about it the afternoon would be over. So it rides
 * above everything for the few weeks it is true, and then takes itself down.
 *
 * Three slides, turning on their own: the clock, the crest and the game. One
 * static banner would have to pick which of the three is the reason to come
 * along, and for a stranger there is no right answer to that. Everything that
 * should stop it moving does: a hover, a focus, the pause button, a hidden
 * tab, and an operating system set to reduce motion.
 *
 * The phase arrives from the server as a prop rather than being worked out
 * here on the first render. Both agree on it that way, which is what keeps
 * hydration quiet, and the effect below takes over immediately afterwards and
 * carries it through the moments the server's copy cannot see.
 */

interface OpenDaySliderProps {
  startsAt: string;
  endsAt: string;
  location: string;
  /** A map for that place, as its own link. Already checked to be http(s). */
  mapUrl: string;
  initialPhase: OpenDayPhase;
  /**
   * The page is shut until the doors open, so the band carries no buttons.
   *
   * Passed in rather than worked out here: the lock is the server's to
   * decide, and it is the same decision the page itself is making.
   */
  locked: boolean;
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function OpenDaySlider({
  startsAt,
  endsAt,
  location,
  mapUrl,
  initialPhase,
  locked,
}: OpenDaySliderProps) {
  const day = useMemo(
    () => ({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) }),
    [startsAt, endsAt],
  );

  const [phase, setPhase] = useState<OpenDayPhase>(initialPhase);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [reduced, setReduced] = useState(false);
  const pointerRef = useRef<number | null>(null);

  // The lock only holds before the doors open, and the phase below is live,
  // so a band left open on screen unlocks itself at the same moment the page
  // does rather than waiting for a reload.
  const slides = useMemo(
    () => openDaySlides({ phase, location, locked: locked && phase === "before" }),
    [phase, location, locked],
  );
  const count = slides.length;
  const still = paused || held || reduced;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // The same boundary timer the stand page runs, for the same reason: somebody
  // leaves this open, the doors open, and the band should say so.
  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      setPhase(openDayPhase(day));
      const next = nextOpenDayBoundary(day);
      if (!next) return;
      const ms = next.getTime() - Date.now();
      if (ms <= 0 || ms > MAX_TIMEOUT_MS) return;
      timer = window.setTimeout(update, ms + 500);
    };
    update();
    return () => window.clearTimeout(timer);
  }, [day]);

  useEffect(() => {
    if (still || count < 2) return;
    const id = window.setInterval(() => {
      // A tab nobody is looking at should not be turning slides: the visitor
      // comes back to slide two of three having seen neither of the others.
      if (document.hidden) return;
      setIndex((current) => nextSlideIndex(current, count));
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [still, count]);

  const step = useCallback(
    (direction: number) => setIndex((current) => nextSlideIndex(current, count, direction)),
    [count],
  );

  // Nothing about yesterday belongs on the front page. The server leaves the
  // band out altogether once the day is done; this is for the visitor who was
  // already sitting here when it ended.
  if (phase === "after") return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="IEEE RAS HTU open day"
      /*
        Two skins for one band.

        It started out dark in both themes, which left the homepage's one
        full-width object ignoring the theme the visitor had chosen. In the
        light theme it is now the same lit panel the competition clock sits on,
        in the same purple-to-rose ramp, with a rule under it so it still reads
        as a band rather than as the top of the page.
      */
      className="open-day-band relative isolate overflow-hidden border-b border-ras-purple/20 bg-[var(--color-surface)] bg-gradient-to-br from-mood-orchid/30 via-ras-purple/10 to-mood-rose/25 text-ras-purple dark:border-mood-violet/30 dark:bg-[#3f1546] dark:bg-[radial-gradient(circle_at_18%_18%,#5f2167_0%,#3f1546_58%,#28092d_100%)] dark:text-white"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
      }}
      onPointerDown={(event) => {
        pointerRef.current = event.clientX;
      }}
      onPointerUp={(event) => {
        const from = pointerRef.current;
        pointerRef.current = null;
        if (from === null) return;
        const travelled = event.clientX - from;
        // Far enough that it was a swipe and not a tap that wandered.
        if (Math.abs(travelled) > 45) step(travelled < 0 ? 1 : -1);
      }}
    >
      {/* A warm line along the top edge. Gold carries on the dark band and
          vanishes into parchment, so the light theme gets the crimson. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ras-crimson/50 to-transparent dark:via-[#f2a900]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-[#d81e5b]/15 blur-3xl dark:bg-[#d81e5b]/25"
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, i) => (
              <Panel
                key={slide.kind}
                slide={slide}
                active={i === index}
                phase={phase}
                day={day}
                mapUrl={mapUrl}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPaused((was) => !was)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-ras-purple/30 px-3 text-[11px] font-semibold uppercase tracking-wider text-ras-purple/80 transition-colors hover:border-ras-purple/60 hover:text-ras-purple dark:border-white/25 dark:text-white/80 dark:hover:border-white/50 dark:hover:text-white"
          >
            {/* "Resume" rather than "Play": one of the dots below is called
                "Play Pac Mouse", and two controls a voice-control user cannot
                tell apart is a worse problem than a slightly longer word. */}
            {paused ? "Resume" : "Pause"}
          </button>

          <div className="flex items-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.kind}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                aria-label={slide.title}
                className={`h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  i === index
                    ? "w-7 bg-ras-crimson dark:bg-[#f2a900]"
                    : "w-2.5 bg-ras-purple/25 hover:bg-ras-purple/50 dark:bg-white/30 dark:hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          {/* The bar is the only thing saying how long a slide has left, so it
              stops dead when everything else does rather than running on under
              a carousel that is not moving. */}
          <div className="ml-auto hidden h-px w-40 overflow-hidden bg-ras-purple/15 sm:block dark:bg-white/15">
            <div
              key={index}
              className={`h-full origin-left bg-ras-purple/45 dark:bg-white/45 ${still ? "" : "open-day-progress"}`}
              style={{ animationDuration: `${SLIDE_INTERVAL_MS}ms` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One slide.
 *
 * The inactive ones stay in the markup so the row can slide, which means they
 * have to be taken out of the tab order by hand: tabbing into a link sitting
 * off the side of the screen scrolls the whole band sideways and looks broken.
 */
function Panel({
  slide,
  active,
  phase,
  day,
  mapUrl,
}: {
  slide: OpenDaySlide;
  active: boolean;
  phase: OpenDayPhase;
  day: { startsAt: Date; endsAt: Date };
  mapUrl: string;
}) {
  return (
    <div className="w-full shrink-0 px-0.5" aria-hidden={!active}>
      <div className="grid items-center gap-5 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ras-crimson dark:text-[#ffb45f]">
            {phase === "during" && slide.kind === "clock" ? <LiveDot /> : null}
            {slide.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ras-gray dark:text-white/75">
            {slide.body}
          </p>
          {slide.linked ? (
            <Link
              href={slide.href}
              tabIndex={active ? undefined : -1}
              className="group mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#f2a900] px-5 text-sm font-bold text-[#2a0e2f] transition-transform duration-200 hover:-translate-y-px active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <MouseMark className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
              {slide.cta}
            </Link>
          ) : null}
        </div>

        <div className="flex justify-start sm:justify-end">
          {slide.kind === "clock" ? (
            <div className="text-center sm:text-right">
              <Countdown
                target={phase === "during" ? day.endsAt : day.startsAt}
                size="md"
                subject={phase === "during" ? OPEN_DAY_END_SUBJECT : OPEN_DAY_SUBJECT}
              />
              {/* The date only. The line beside it already says where, and the
                  place printed twice in one slide reads as a mistake. */}
              <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
                {phase === "during"
                  ? `Open until ${openDayClock(day.endsAt)}`
                  : openDayDateLabel(day)}
              </p>
              {/* The map as a link, rather than as a line of URL inside the
                  sentence above it. It stays even while the page is shut: it
                  points at a map, not at the page nobody can open yet. */}
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={active ? undefined : -1}
                  className="-mx-2 mt-0.5 inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs font-bold underline-offset-2 hover:underline"
                >
                  Find it on the map
                  <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </div>
          ) : slide.kind === "crest" ? (
            <CrestGlyph />
          ) : (
            <PlayGlyph />
          )}
        </div>
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span aria-hidden="true" className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ras-crimson/70 motion-reduce:hidden dark:bg-[#ffb45f]/70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-ras-crimson dark:bg-[#ffb45f]" />
    </span>
  );
}

/** A crest, reduced to the shape every one of them has: walls and a gold centre. */
function CrestGlyph() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-16 w-16 text-ras-purple/70 dark:text-white sm:h-28 sm:w-28"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="3"
      />
      <path
        d="M22 22h24M22 22v20M60 22v18M78 34H60M34 56H22M22 70h16M46 78V56M46 56h18M64 78h14M78 56v22M60 66h18M34 38v10M68 46h10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="42" y="38" width="20" height="20" rx="3" fill="#f2a900" fillOpacity="0.85" />
    </svg>
  );
}

/** The game, reduced the same way: a mouse and the pellets in front of it. */
function PlayGlyph() {
  return (
    <svg
      viewBox="0 0 120 60"
      className="h-14 w-28 text-ras-purple/70 dark:text-white sm:h-24 sm:w-48"
      aria-hidden="true"
    >
      <path
        d="M34 8a22 22 0 1 0 0 44 22 22 0 0 0 19-11L34 30l19-11A22 22 0 0 0 34 8z"
        fill="#f2a900"
      />
      <circle cx="34" cy="21" r="2.6" fill="#2a0e2f" />
      <circle cx="74" cy="30" r="5" fill="currentColor" fillOpacity="0.75" />
      <circle cx="94" cy="30" r="5" fill="currentColor" fillOpacity="0.5" />
      <circle cx="112" cy="30" r="5" fill="currentColor" fillOpacity="0.28" />
    </svg>
  );
}
