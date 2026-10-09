"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  JOURNEY_ERAS,
  nextPlace,
  previousPlace,
  scrollFor,
  type JourneyStop,
  type TourPlace,
} from "@/lib/journey";

/** How long each note holds while the tour plays itself. */
const NOTE_MS = 5200;

function useWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

function prefersStill(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The tour itself: a browser frame holding a capture of the page as it was,
 * scrolled to each note in turn with a pin on what it is talking about. It
 * plays itself or is stepped by hand, and the capture can always be scrolled
 * freely, like the page it was.
 */
export function JourneyTour({ stops }: { stops: readonly JourneyStop[] }) {
  const [place, setPlace] = useState<TourPlace>({ stop: 0, note: 0 });
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const wide = useWide();
  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);

  const stop = stops[place.stop]!;
  const note = stop.notes[place.note];
  const image = wide || !stop.phone ? stop.image : stop.phone;
  const onPhone = !wide && !!stop.phone;
  const era = JOURNEY_ERAS.find((item) => item.id === stop.era)!;
  const eraStops = stops.map((item, index) => ({ item, index })).filter(({ item }) => item.era === stop.era);

  const go = useCallback((to: TourPlace) => {
    setFinished(false);
    setPlace(to);
  }, []);

  const forward = useCallback(() => {
    const next = nextPlace(stops, place);
    if (next) go(next);
    else {
      setPlaying(false);
      setFinished(true);
    }
  }, [go, place, stops]);

  const back = useCallback(() => {
    const before = previousPlace(stops, place);
    if (before) go(before);
  }, [go, place, stops]);

  // Scroll the capture to the note, once the image knows its size.
  const scrollToNote = useCallback(() => {
    const box = frame.current;
    const img = picture.current;
    if (!box || !img || !img.complete) return;
    const fraction = onPhone ? note?.phoneY : note?.y;
    if (fraction === null || fraction === undefined) return;
    box.scrollTo({ top: scrollFor(fraction, img.clientHeight, box.clientHeight), behavior: prefersStill() ? "auto" : "smooth" });
  }, [note, onPhone]);

  // A new page starts at its top before the first note pulls it down. Before
  // the effect below, so the jump to the top never cancels the glide.
  useEffect(() => {
    frame.current?.scrollTo({ top: 0 });
  }, [place.stop, wide]);

  useEffect(() => {
    scrollToNote();
  }, [scrollToNote, image.src]);

  // The next stop's capture, fetched while this one is being read.
  useEffect(() => {
    const next = stops[place.stop + 1];
    if (!next) return;
    const preload = new Image();
    preload.src = (wide || !next.phone ? next.image : next.phone).src;
  }, [place.stop, stops, wide]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(forward, NOTE_MS);
    return () => window.clearTimeout(id);
  }, [playing, forward]);

  // Arrow keys step the tour while it has focus.
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      forward();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      back();
    }
  };

  const atStart = place.stop === 0 && place.note === 0;

  return (
    <div className="mt-10" onKeyDown={onKey}>
      <div role="tablist" aria-label="Era" className="grid grid-cols-2 gap-2 sm:inline-grid sm:auto-cols-fr sm:grid-flow-col">
        {JOURNEY_ERAS.map((item) => {
          const first = stops.findIndex((s) => s.era === item.id);
          const active = item.id === stop.era;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => go({ stop: first, note: 0 })}
              className={`rounded-xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none ${
                active
                  ? "border-ras-purple bg-ras-purple text-white dark:border-white dark:bg-white dark:text-ras-purple"
                  : "border-ras-gray/20 bg-[var(--color-surface)] text-ras-purple hover:border-ras-purple/50 dark:text-white"
              }`}
            >
              <span className="block font-semibold">{item.title}</span>
              <span className={`block font-mono text-[11px] uppercase tracking-[0.14em] ${active ? "opacity-80" : "text-ras-gray dark:text-white/60"}`}>{item.when}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 max-w-2xl text-ras-gray dark:text-white/70">{era.lead}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* The frame: a browser on a wide screen, a phone on a narrow one. */}
        <figure className={`mx-auto w-full overflow-hidden border border-black/10 bg-[#17101c] shadow-[0_30px_70px_-30px_rgba(40,10,50,0.55)] dark:border-white/15 ${onPhone ? "max-w-[22rem] rounded-[2.2rem] p-2.5" : "rounded-xl"}`}>
          {onPhone ? (
            <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-white/20" />
          ) : (
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
              <span aria-hidden="true" className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-md bg-white/[0.08] px-3 py-1 text-center font-mono text-xs text-white/75">
                mmrchtu.tech{stop.path === "/" ? "" : stop.path}
              </span>
              <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 sm:inline">{era.when}</span>
            </div>
          )}
          <div
            ref={frame}
            tabIndex={0}
            aria-label={`The ${stop.title.toLowerCase()} page, scrollable`}
            onWheel={() => setPlaying(false)}
            onTouchStart={() => setPlaying(false)}
            className={`relative overflow-y-auto overscroll-contain bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${onPhone ? "aspect-[390/720] rounded-[1.7rem]" : stop.image.width / stop.image.height > 1.5 ? "aspect-video" : "aspect-[16/10]"}`}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- static captures, already sized */}
              <img
                key={image.src}
                ref={picture}
                src={image.src}
                width={image.width}
                height={image.height}
                alt={`The ${stop.path} page of mmrchtu.tech during ${era.title.toLowerCase()}`}
                onLoad={scrollToNote}
                className="block h-auto w-full animate-[fadeIn_400ms_ease-out] motion-reduce:animate-none"
              />
              {stop.notes.map((item, index) => {
                const y = onPhone ? item.phoneY : item.y;
                if (y === null) return null;
                const active = index === place.note;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => go({ stop: place.stop, note: index })}
                    aria-label={`Note ${index + 1}: ${item.title}`}
                    style={{ left: `${(onPhone ? 0.08 : item.x) * 100}%`, top: `${y * 100}%` }}
                    className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono text-xs font-bold shadow-lg transition-[transform,background-color] duration-300 motion-reduce:transition-none ${
                      active ? "scale-110 bg-[#f2a900] text-[#2a1d2e]" : "bg-ras-purple/85 text-white hover:scale-105"
                    }`}
                  >
                    {active ? <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-[#f2a900]/60 motion-reduce:hidden" /> : null}
                    <span className="relative">{index + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <figcaption className="sr-only">
            {stop.title}. {stop.intro}
          </figcaption>
        </figure>

        {/* The guide, on its own surface so the site's artwork never runs under the words. */}
        <div className="min-w-0 rounded-xl border border-ras-gray/15 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Stop {eraStops.findIndex(({ index }) => index === place.stop) + 1} of {eraStops.length}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ras-purple dark:text-white">{stop.title}</h2>
          <p className="mt-2 text-ras-gray dark:text-white/70">{stop.intro}</p>

          <ol className="mt-5 space-y-2" aria-label="Notes on this page">
            {stop.notes.map((item, index) => {
              const active = index === place.note;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => go({ stop: place.stop, note: index })}
                    aria-current={active ? "step" : undefined}
                    className={`flex w-full gap-3 rounded-lg border p-3 text-left transition-colors motion-reduce:transition-none ${
                      active ? "border-[#f2a900] bg-[#f2a900]/10" : "border-ras-gray/15 hover:border-ras-purple/40"
                    }`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold ${active ? "bg-[#f2a900] text-[#2a1d2e]" : "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white"}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ras-purple dark:text-white">{item.title}</span>
                      {active ? <span className="mt-1 block text-sm text-ras-gray dark:text-white/70">{item.body}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p aria-live="polite" className="sr-only">
            {note ? `${stop.title}, note ${place.note + 1}: ${note.title}. ${note.body}` : ""}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={back}
              disabled={atStart}
              className="rounded-full border border-ras-gray/25 px-4 py-2 text-sm font-semibold text-ras-purple disabled:opacity-40 dark:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (finished) go({ stop: 0, note: 0 });
                setPlaying((value) => !value || finished);
              }}
              className="rounded-full bg-ras-purple px-5 py-2 text-sm font-semibold text-white hover:bg-ras-purple/90 dark:bg-white dark:text-ras-purple"
            >
              {playing ? "Pause" : finished ? "Play again" : atStart ? "Play the tour" : "Play"}
            </button>
            <button
              type="button"
              onClick={forward}
              className="rounded-full border border-ras-gray/25 px-4 py-2 text-sm font-semibold text-ras-purple dark:text-white"
            >
              Next
            </button>
            {stop.live ? (
              <Link href={stop.path} className="ml-auto text-sm font-semibold text-accent underline-offset-4 hover:underline">
                Open it now
              </Link>
            ) : (
              <span className="ml-auto text-xs text-ras-gray dark:text-white/50">Closed since the day</span>
            )}
          </div>
          {playing ? (
            <div aria-hidden="true" className="mt-4 h-0.5 overflow-hidden rounded-full bg-ras-gray/15">
              <div key={`${place.stop}-${place.note}`} className="h-full origin-left bg-[#f2a900] [animation:journey-bar_var(--note-ms)_linear_forwards]" style={{ ["--note-ms" as string]: `${NOTE_MS}ms` }} />
            </div>
          ) : null}

          {finished ? (
            <div className="mt-6 rounded-xl border border-[#f2a900]/50 bg-[#f2a900]/10 p-4">
              <p className="font-semibold text-ras-purple dark:text-white">That was the journey.</p>
              <p className="mt-1 text-sm text-ras-gray dark:text-white/70">From the first sign-up to the last photo. Thank you for coming along.</p>
              <p className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                <Link href="/results" className="text-accent underline-offset-4 hover:underline">
                  See the results
                </Link>
                <Link href="/" className="text-accent underline-offset-4 hover:underline">
                  Back to the homepage
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Every stop of this era, to jump straight to one. */}
      <nav aria-label={`${era.title} stops`} className="mt-10">
        <ol className="flex snap-x gap-3 overflow-x-auto pb-3">
          {eraStops.map(({ item, index }, position) => {
            const active = index === place.stop;
            const thumb = item.image;
            return (
              <li key={item.id} className="w-40 shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => go({ stop: index, note: 0 })}
                  aria-current={active ? "step" : undefined}
                  className={`block w-full overflow-hidden rounded-lg border bg-[var(--color-surface)] text-left transition-colors motion-reduce:transition-none ${active ? "border-[#f2a900] ring-2 ring-[#f2a900]/40" : "border-ras-gray/20 hover:border-ras-purple/50"}`}
                >
                  <span className="block aspect-[16/10] overflow-hidden bg-[#17101c]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static captures */}
                    <img src={thumb.src} alt="" loading="lazy" className="w-full object-cover object-top" />
                  </span>
                  <span className="block px-2.5 py-2">
                    <span className="block font-mono text-[10px] text-ras-gray dark:text-white/55">{String(position + 1).padStart(2, "0")}</span>
                    <span className="block truncate text-sm font-semibold text-ras-purple dark:text-white">{item.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
