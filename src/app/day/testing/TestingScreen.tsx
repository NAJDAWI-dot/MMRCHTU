"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { DayIcon } from "@/components/day-site/icons";
import { SponsorWall, type WallSponsor } from "@/components/day-site/SponsorWall";
import { BOARD_VIEWBOX, BoardMouse, BoardRoute, BoardWalls, FloodNumbers, HEAD_START, useBoard } from "@/components/day-site/MazeBoard";
import { MMRC_PLATE } from "@/lib/brand";
import { Clock } from "../screen/HallScreen";

export interface TestingPhoto {
  id: string;
  url: string;
  caption: string;
  /** "4 min ago", worked out on the server at the last refresh. */
  posted: string;
}

type Slide = "main" | "photos" | "sponsors";
const SLIDES: readonly Slide[] = ["main", "photos", "sponsors"];

/** Seconds on the title slide, on each photo, and on the sponsors. */
const MAIN_S = 15;
const PHOTO_S = 6;
const SPONSORS_S = 12;
/** The photo slide shows at most this many before handing back. */
const PHOTOS_PER_PASS = 8;

/** One practice run: the mouse runs for RUN_MS, waits in the gold room, then sets off again. */
const RUN_MS = 11_000;
const REST_MS = 2_600;

/**
 * The mouse doing practice runs on the board, again and again, with a stopwatch
 * beside it. Driven by time rather than the page's scroll, which is what the
 * day site's floor uses. With reduced motion the route is drawn whole and the
 * mouse waits in the centre.
 */
function usePracticeRuns(routeRef: RefObject<SVGPathElement>, mouseRef: RefObject<SVGGElement>, timerRef: RefObject<HTMLElement>, runRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const path = routeRef.current;
    const mouse = mouseRef.current;
    if (!path || !mouse) return;
    const length = path.getTotalLength();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const place = (run: number) => {
      path.style.strokeDashoffset = String(1 - run);
      const at = Math.min(length, run * length);
      const here = path.getPointAtLength(at);
      const ahead = path.getPointAtLength(Math.min(length, at + 2));
      const behind = path.getPointAtLength(Math.max(0, at - 2));
      const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
      mouse.setAttribute("transform", `translate(${here.x.toFixed(2)} ${here.y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
    };

    if (still) {
      place(1);
      return;
    }

    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      const lap = Math.floor(elapsed / (RUN_MS + REST_MS));
      const into = elapsed - lap * (RUN_MS + REST_MS);
      const running = into < RUN_MS;
      const t = Math.min(1, into / RUN_MS);
      // Quick off the line, careful into the centre: the way a mouse that is still being tuned runs.
      const eased = 1 - Math.pow(1 - t, 1.6);
      place(HEAD_START + eased * (1 - HEAD_START));
      if (timerRef.current) {
        const ms = running ? into : RUN_MS;
        timerRef.current.textContent = `${String(Math.floor(ms / 1000)).padStart(2, "0")}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
      }
      if (runRef.current) runRef.current.textContent = String(lap + 1).padStart(2, "0");
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [routeRef, mouseRef, timerRef, runRef]);
}

export interface Venue {
  /** The room or building, said large: "Building 23C". */
  place: string;
  /** Where that is, said small. */
  area: string;
}

function MainSlide({ today, venue, countdown }: { today: string; venue: Venue; countdown: { value: string; label: string } | null }) {
  const { maze, route, flood, posts } = useBoard();
  const routeRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef<SVGGElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<HTMLSpanElement>(null);
  usePracticeRuns(routeRef, mouseRef, timerRef, runRef);

  const facts = [
    { label: "Today", value: today, note: "", span: "1fr" },
    { label: "Where", value: venue.place, note: venue.area, span: "1.35fr" },
    ...(countdown ? [{ label: "Competition day", value: countdown.value, note: countdown.label, span: "1fr" }] : []),
  ];

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.15fr)_auto] items-center gap-[6vh]">
      <div className="testing-rise min-w-0">
        <p className="day-kicker text-[2.2vh]">MMRC 26 · Maze Solver Robot Competition</p>
        <h1 className="day-display mt-[2vh] text-[16vh] leading-[0.86] text-day-ink">
          Testing
          <br />
          <span className="text-day-crimson">day</span>
        </h1>
        <p className="mt-[3.5vh] max-w-[34ch] text-[3vh] leading-snug text-day-muted">
          Robots on the official maze. Practice runs, sensor checks and tuning before competition day.
        </p>
        {/* One row, however many facts: a second row would run into the footer. */}
        <dl className="mt-[5vh] grid gap-[2vh]" style={{ gridTemplateColumns: facts.map((fact) => `minmax(0, ${fact.span})`).join(" ") }}>
          {facts.map((fact) => (
            <div key={fact.label} className="day-card day-posts min-w-0 px-[2.6vh] py-[2.2vh]">
              <dt className="text-[1.7vh] font-semibold text-day-faint">{fact.label}</dt>
              <dd className="day-display mt-[0.8vh] text-[3.2vh] leading-tight text-day-ink">{fact.value}</dd>
              {fact.note ? <dd className="mt-[0.6vh] text-[1.8vh] text-day-muted">{fact.note}</dd> : null}
            </div>
          ))}
        </dl>
      </div>

      <figure className="testing-board relative" aria-hidden="true">
        <svg viewBox={BOARD_VIEWBOX} className="h-full w-full">
          <FloodNumbers flood={flood} className="testing-maze-flood" goalClassName="testing-maze-goal" />
          <BoardRoute ref={routeRef} d={route.solution} className="testing-maze-route" />
          <BoardWalls walls={maze.walls} posts={posts} prefix="testing-maze" />
          <BoardMouse ref={mouseRef} start={route.start} sensorsClassName="testing-maze-sensors" />
        </svg>
        <figcaption className="testing-stopwatch day-num">
          <span className="text-day-faint">Run</span> <span ref={runRef}>01</span>
          <span className="mx-[1.4vh] text-day-faint">·</span>
          <span ref={timerRef} className="text-day-ink">00.00</span>
          <span className="text-day-faint">s</span>
        </figcaption>
      </figure>
    </div>
  );
}

function PhotoSlide({ photos, count }: { photos: TestingPhoto[]; count: number }) {
  const shown = photos.slice(0, PHOTOS_PER_PASS);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (shown.length < 2) return;
    const timer = setInterval(() => setActive((value) => (value + 1) % shown.length), PHOTO_S * 1000);
    return () => clearInterval(timer);
  }, [shown.length]);

  if (!shown.length) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="testing-rise">
          <DayIcon name="camera" className="mx-auto h-[9vh] w-[9vh] text-day-crimson" />
          <p className="day-display mt-[3vh] text-[8vh] leading-none text-day-ink">Photos from today</p>
          <p className="mt-[2vh] text-[2.8vh] text-day-muted">They show up here as soon as they are taken.</p>
        </div>
      </div>
    );
  }

  const current = shown[Math.min(active, shown.length - 1)]!;
  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-[2.2vh]">
      <div className="relative min-h-0 overflow-hidden rounded-[0.6vh] bg-black">
        {shown.map((photo, index) => (
          <figure key={photo.id} className="testing-photo absolute inset-0" data-on={index === active ? "true" : undefined}>
            {/* Every photo fills the wide frame, portrait ones too, cropped a little above the middle where faces and robots tend to be. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption || "A photo from the testing day"} className="testing-photo-img h-full w-full object-cover object-[50%_40%]" />
          </figure>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-[4vh] pb-[3vh] pt-[12vh] text-white">
          <p className="flex items-center gap-[1.2vh] text-[2.1vh] font-semibold text-white/85">
            <span className="day-live-dot" aria-hidden="true" />
            Live from the hall · {current.posted}
          </p>
          {current.caption ? <p className="mt-[1vh] max-w-[60ch] text-[4vh] font-semibold leading-tight">{current.caption}</p> : null}
        </div>
        <p className="day-num absolute right-[3vh] top-[2.5vh] rounded-[0.4vh] bg-black/55 px-[1.4vh] py-[0.5vh] text-[1.9vh] font-semibold text-white">
          {count} photo{count === 1 ? "" : "s"} so far
        </p>
      </div>

      <ol className="grid h-[11vh] gap-[1.4vh]" style={{ gridTemplateColumns: `repeat(${PHOTOS_PER_PASS}, minmax(0, 1fr))` }} aria-label="Latest photos">
        {shown.map((photo, index) => (
          <li key={photo.id} className={`testing-thumb overflow-hidden rounded-[0.4vh] ${index === active ? "testing-thumb-on" : ""}`}>
            <button type="button" onClick={() => setActive(index)} className="block h-full w-full" aria-label={`Show photo ${index + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SponsorsSlide({ sponsors }: { sponsors: WallSponsor[] }) {
  return (
    <div className="testing-rise flex h-full flex-col">
      <p className="day-kicker text-center text-[2.2vh]">With thanks</p>
      <h2 className="day-display mt-[1vh] text-center text-[8vh] leading-none text-day-ink">Our sponsors</h2>
      <div className="mt-[4vh] flex min-h-0 flex-1 flex-col">
        <SponsorWall sponsors={sponsors} />
      </div>
    </div>
  );
}

/**
 * The testing day screen: a title slide, a slide of the photos as they come
 * in and, once the Sponsors desk has any, the sponsors, taking turns. Arrow
 * keys step, space pauses, F goes full screen. ?slide=photos (or main, or
 * sponsors) holds one slide; ?theme=light suits a bright room.
 */
export function TestingScreen({
  today,
  venue,
  countdown,
  photos,
  count,
  sponsors,
}: {
  today: string;
  venue: Venue;
  countdown: { value: string; label: string } | null;
  photos: TestingPhoto[];
  count: number;
  sponsors: WallSponsor[];
}) {
  const slides: { key: Slide; label: string }[] = [
    { key: "main", label: "Testing day" },
    { key: "photos", label: "Photos" },
    ...(sponsors.length ? [{ key: "sponsors" as const, label: "Sponsors" }] : []),
  ];
  const [pinned, setPinned] = useState<Slide | null>(null);
  const [light, setLight] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const slide = query.get("slide");
    setPinned(SLIDES.find((key) => key === slide) ?? null);
    setLight(query.get("theme") === "light");
  }, []);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [full, setFull] = useState(false);

  // A slide held by the address that is not on (sponsors, before there are any) holds nothing.
  const held = pinned && slides.some((slide) => slide.key === pinned) ? pinned : null;
  const at = held ? slides.findIndex((slide) => slide.key === held) : index % slides.length;
  const current = slides[at]!;
  const photoCount = Math.min(photos.length, PHOTOS_PER_PASS);
  // The photo slide stays long enough to go through the latest photos once.
  const dwell = (current.key === "main" ? MAIN_S : current.key === "sponsors" ? SPONSORS_S : photoCount ? Math.max(2, photoCount) * PHOTO_S : 8) * 1000;
  const holding = paused || held !== null;

  const step = useCallback((delta: number) => setIndex((value) => (value + delta + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (holding) return;
    const timer = setTimeout(() => step(1), dwell);
    return () => clearTimeout(timer);
  }, [at, dwell, holding, step]);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key === "f" || event.key === "F") toggleFull();
    };
    const onFull = () => setFull(!!document.fullscreenElement);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    onMove();
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("mousemove", onMove);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("mousemove", onMove);
    };
  }, [step, toggleFull]);

  return (
    <div className={light ? "" : "dark"}>
      <div className="day-root testing-screen h-dvh overflow-hidden" style={{ position: "fixed", inset: 0, zIndex: 60 }}>
        <div className="day-checker pointer-events-none absolute inset-x-0 top-0 h-[1.2vh] opacity-[0.12]" aria-hidden="true" />
        <div className={`relative grid h-full grid-rows-[auto_minmax(0,1fr)_auto] ${idle ? "cursor-none" : ""}`}>
          <DayAutoRefresh everyMs={15_000} />

          <header className="flex items-center justify-between gap-[3vh] px-[4vh] pb-[1.5vh] pt-[3vh]">
            <div className="flex min-w-0 items-center gap-[2vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo/mmrc-mark.png" alt="" className="h-[7vh] w-[7vh] rounded-[0.5vh] object-contain p-[0.8vh]" style={{ backgroundColor: MMRC_PLATE }} />
              <div className="min-w-0 leading-none">
                <p className="font-brand text-[4.2vh] text-day-ink">MMRC 26</p>
                <p className="day-kicker mt-[0.8vh] truncate text-[1.6vh]">Testing day</p>
              </div>
            </div>
            <div className="flex items-center gap-[2vh]">
              <button
                type="button"
                onClick={toggleFull}
                className={`day-btn day-btn-soft day-btn-sm transition-opacity ${idle || full ? "pointer-events-none opacity-0" : "opacity-100"}`}
                aria-label={full ? "Leave full screen" : "Full screen"}
              >
                <DayIcon name="expand" className="h-4 w-4" />
                {full ? "Exit" : "Full screen"}
              </button>
              <Clock />
            </div>
          </header>

          <main className="relative min-h-0 px-[4vh] py-[2vh]">
            <section key={`${current.key}-${index}`} aria-label={current.label} className="screen-panel h-full">
              {current.key === "main" ? (
                <MainSlide today={today} venue={venue} countdown={countdown} />
              ) : current.key === "sponsors" ? (
                <SponsorsSlide sponsors={sponsors} />
              ) : (
                <PhotoSlide photos={photos} count={count} />
              )}
            </section>
          </main>

          <footer>
            <div className="flex items-center justify-between gap-[3vh] px-[4vh] py-[1.8vh]">
              <p className="text-[2vh] text-day-muted">
                Follow MMRC 26 at <span className="font-semibold text-day-ink">mmrchtu.tech</span>
              </p>
              <ol className="flex items-center gap-[1vh]" aria-label="Slides">
                {slides.map((slide, i) => (
                  <li key={slide.key}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={slide.key === current.key ? "true" : undefined}
                      className={`rounded-[2px] px-[1.4vh] py-[0.5vh] text-[1.6vh] font-semibold transition-colors ${
                        slide.key === current.key ? "bg-day-ink text-day-on-ink" : "text-day-faint hover:text-day-ink"
                      }`}
                    >
                      {slide.label}
                    </button>
                  </li>
                ))}
                {holding ? <li className="text-[1.6vh] font-semibold text-day-faint">· held</li> : null}
              </ol>
            </div>
            <div className="h-[0.6vh] bg-day-ink/10" aria-hidden="true">
              {holding ? null : <div key={`${at}-${index}`} className="screen-progress h-full bg-day-crimson" style={{ animationDuration: `${dwell}ms` } as CSSProperties} />}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
