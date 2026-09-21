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
      className="open-day-band relative isolate overflow-hidden bg-[#3f1546] bg-[radial-gradient(circle_at_18%_18%,#5f2167_0%,#3f1546_58%,#28092d_100%)] text-white"
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
      {/* Gold along the top edge, the one warm line in a very purple band. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f2a900] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-[#d81e5b]/25 blur-3xl"
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
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPaused((was) => !was)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/25 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 transition-colors hover:border-white/50 hover:text-white"
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
                  i === index ? "w-7 bg-[#f2a900]" : "w-2.5 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          {/* The bar is the only thing saying how long a slide has left, so it
              stops dead when everything else does rather than running on under
              a carousel that is not moving. */}
          <div className="ml-auto hidden h-px w-40 overflow-hidden bg-white/15 sm:block">
            <div
              key={index}
              className={`h-full origin-left bg-white/45 ${still ? "" : "open-day-progress"}`}
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
}: {
  slide: OpenDaySlide;
  active: boolean;
  phase: OpenDayPhase;
  day: { startsAt: Date; endsAt: Date };
}) {
  return (
    <div className="w-full shrink-0 px-0.5" aria-hidden={!active}>
      <div className="grid items-center gap-5 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#ffb45f]">
            {phase === "during" && slide.kind === "clock" ? <LiveDot /> : null}
            {slide.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">{slide.body}</p>
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
              <p className="mt-2 text-xs text-white/60">
                {phase === "during"
                  ? `Open until ${openDayClock(day.endsAt)}`
                  : openDayDateLabel(day)}
              </p>
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
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffb45f]/70 motion-reduce:hidden" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffb45f]" />
    </span>
  );
}

/** A crest, reduced to the shape every one of them has: walls and a gold centre. */
function CrestGlyph() {
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16 sm:h-28 sm:w-28" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="8"
        fill="none"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="3"
      />
      <path
        d="M22 22h24M22 22v20M60 22v18M78 34H60M34 56H22M22 70h16M46 78V56M46 56h18M64 78h14M78 56v22M60 66h18M34 38v10M68 46h10"
        fill="none"
        stroke="white"
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
    <svg viewBox="0 0 120 60" className="h-14 w-28 sm:h-24 sm:w-48" aria-hidden="true">
      <path
        d="M34 8a22 22 0 1 0 0 44 22 22 0 0 0 19-11L34 30l19-11A22 22 0 0 0 34 8z"
        fill="#f2a900"
      />
      <circle cx="34" cy="21" r="2.6" fill="#2a0e2f" />
      <circle cx="74" cy="30" r="5" fill="white" fillOpacity="0.75" />
      <circle cx="94" cy="30" r="5" fill="white" fillOpacity="0.5" />
      <circle cx="112" cy="30" r="5" fill="white" fillOpacity="0.28" />
    </svg>
  );
}
