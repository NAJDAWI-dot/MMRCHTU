"use client";

import { Caveat } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { MAZE_GOLD } from "@/lib/maze";
import { SPLASH_PENDING_CLASS } from "@/lib/splash";

/** The signature's hand. Loaded here, so only the page with the letter pays for it. */
const signature = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });

export interface CreditsMaze {
  viewBox: string;
  span: number;
  walls: string[];
  solution: string;
  goal: { x: number; y: number; size: number };
  cells: number;
}

export interface CreditsProps {
  maze: CreditsMaze;
  name: string;
  role: string;
  linkedIn: string;
  stats: readonly { value: number; label: string; approx?: boolean }[];
  started: string;
  /** The credit lines before the name, film style: who did what. */
  lines: { role: string; name: string }[];
  paragraphs: string[];
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#";

/** Whether the visitor has asked for less motion. Read once, on the client. */
function prefersStill(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs `step` with 0..1 over `ms`, eased, and `done` at the end. Returns a cancel. */
function tween(ms: number, step: (t: number) => void, done?: () => void): () => void {
  let frame = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    step(t);
    if (t < 1) frame = requestAnimationFrame(tick);
    else done?.();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** Starts once, the first time the element is well into view. */
function useSeen<T extends Element>(threshold = 0.45) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/**
 * Whether the site's intro has cleared. The credits open the page, so the run
 * waits for the splash rather than playing out underneath it.
 */
function useSplashGone(): boolean {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const check = () => setGone(!root.classList.contains(SPLASH_PENDING_CLASS));
    check();
    const observer = new MutationObserver(check);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return gone;
}

/** The name, scrambled while the mouse is still looking, decoding letter by letter when it arrives. */
function DecodedName({ name, arrived }: { name: string; arrived: boolean }) {
  const [shown, setShown] = useState(name);
  useEffect(() => {
    if (prefersStill()) return;
    const scramble = () =>
      name
        .split("")
        .map((char) => (char === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join("");
    if (!arrived) {
      setShown(scramble());
      const id = window.setInterval(() => setShown(scramble()), 90);
      return () => window.clearInterval(id);
    }
    return tween(
      1100,
      (t) => {
        const settled = Math.floor(t * name.length);
        setShown(
          name
            .split("")
            .map((char, i) => (i < settled || char === " " ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(""),
        );
      },
      () => setShown(name),
    );
  }, [arrived, name]);

  return (
    <span aria-label={name} className="block">
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

/** A number counting up once it is on screen. */
function CountUp({ value, approx, run }: { value: number; approx?: boolean; run: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (prefersStill()) return;
    if (!run) {
      setShown(0);
      return;
    }
    return tween(1400, (t) => setShown(Math.round(value * (1 - Math.pow(1 - t, 3)))));
  }, [run, value]);
  return (
    <>
      {new Intl.NumberFormat("en-GB").format(shown)}
      {approx ? "+" : ""}
    </>
  );
}

/**
 * The run: the mouse leaves its corner when the maze comes into view and
 * drives the route to the centre, drawing its trail. Arriving is what reveals
 * the credit. Under reduced motion it is already there.
 */
function MazeRun({ maze, onArrive }: { maze: CreditsMaze; onArrive: () => void }) {
  const [frame, inView] = useSeen<HTMLDivElement>(0.5);
  const clear = useSplashGone();
  const seen = inView && clear;
  const route = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const mouse = useRef<SVGGElement>(null);
  const [arrived, setArrived] = useState(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  useEffect(() => {
    const path = route.current;
    if (!path || !trail.current || !mouse.current) return;
    const length = path.getTotalLength();
    const place = (t: number) => {
      const at = path.getPointAtLength(length * t);
      const ahead = path.getPointAtLength(Math.min(length, length * t + 2));
      const behind = path.getPointAtLength(Math.max(0, length * t - 2));
      const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
      mouse.current!.setAttribute("transform", `translate(${at.x} ${at.y}) rotate(${angle})`);
      trail.current!.style.strokeDasharray = `${length}`;
      trail.current!.style.strokeDashoffset = `${length * (1 - t)}`;
    };
    if (prefersStill()) {
      place(1);
      setArrived(true);
      arrive.current();
      return;
    }
    place(0);
    if (!seen) return;
    // About a cell every tenth of a second: quick enough to wait for, slow
    // enough to follow the turns.
    const ms = Math.min(5200, Math.max(2600, maze.cells * 95));
    return tween(
      ms,
      (t) => place(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      () => {
        setArrived(true);
        arrive.current();
      },
    );
  }, [seen, maze.cells]);

  return (
    <div ref={frame} className="relative mx-auto w-full max-w-[26rem]">
      <svg viewBox={maze.viewBox} className="block h-auto w-full overflow-visible" role="img" aria-label="A micromouse drives through a maze to the gold centre">
        <defs>
          <radialGradient id="credits-glow">
            <stop offset="0%" stopColor={MAZE_GOLD} stopOpacity="0.85" />
            <stop offset="100%" stopColor={MAZE_GOLD} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx={maze.goal.x + maze.goal.size / 2}
          cy={maze.goal.y + maze.goal.size / 2}
          r={maze.goal.size * 1.6}
          fill="url(#credits-glow)"
          className={`transition-opacity duration-700 motion-reduce:transition-none ${arrived ? "opacity-60" : "opacity-0"}`}
        />
        <rect
          x={maze.goal.x + 2}
          y={maze.goal.y + 2}
          width={maze.goal.size - 4}
          height={maze.goal.size - 4}
          rx={3}
          fill={MAZE_GOLD}
          fillOpacity={arrived ? 0.35 : 0.12}
          stroke={MAZE_GOLD}
          strokeWidth={1.6}
          className="transition-[fill-opacity] duration-700 motion-reduce:transition-none"
        />
        <path ref={route} d={maze.solution} fill="none" stroke="none" />
        <path ref={trail} d={maze.solution} fill="none" stroke="#e0526e" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
        {maze.walls.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth={2.2} strokeLinecap="round" />
        ))}
        <rect x={0} y={0} width={maze.span} height={maze.span} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth={2.2} />
        {/* The mouse, pointing along +x and turned to its heading. */}
        <g ref={mouse}>
          <ellipse cx={0} cy={0} rx={6.2} ry={4.6} fill="#f6ecf7" />
          <circle cx={-2.4} cy={-4.4} r={2.2} fill="#f6ecf7" />
          <circle cx={-2.4} cy={4.4} r={2.2} fill="#f6ecf7" />
          <circle cx={4.6} cy={0} r={1.1} fill="#e0526e" />
          <circle cx={2.2} cy={-1.7} r={0.8} fill="#1b0f22" />
          <circle cx={2.2} cy={1.7} r={0.8} fill="#1b0f22" />
        </g>
      </svg>
      <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-white/45">10 × 10 · seed 26 · flood fill</p>
    </div>
  );
}

/** The letter, on paper, with the signature drawn in as it comes into view. */
function Letter({ name, paragraphs }: { name: string; paragraphs: string[] }) {
  const [ref, seen] = useSeen<HTMLDivElement>(0.6);
  // Drawn in only once the page is awake and motion is welcome; otherwise the
  // signature is simply there, as it would be on paper.
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(!prefersStill()), []);
  const first = name.split(" ")[0] ?? name;
  return (
    <article
      aria-labelledby="letter-title"
      className="relative mx-auto mt-20 max-w-2xl rotate-[-0.6deg] rounded-[6px] bg-[#f8f2ea] px-6 py-10 text-[#2a1d2e] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] motion-reduce:rotate-0 sm:px-12 sm:py-14"
    >
      {/* Ruled faintly, like a page from a notebook. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.35] [background:repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,rgba(95,33,103,0.12)_31px,rgba(95,33,103,0.12)_32px)]"
      />
      <div className="relative">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#862633]">A message from the developer</p>
        <h3 id="letter-title" className="sr-only">
          A message from {name}
        </h3>
        <div className="mt-6 space-y-5 text-[1.05rem] leading-[1.85]" dir="auto">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
        <div ref={ref} className="mt-10">
          <p
            aria-hidden="true"
            className={`${signature.className} inline-block text-5xl leading-none text-[#5f2167] transition-[clip-path] duration-[1600ms] ease-out motion-reduce:transition-none ${
              armed && !seen ? "[clip-path:inset(0_100%_0_0)]" : "[clip-path:inset(0_0_0_0)]"
            }`}
          >
            {first}
          </p>
          <p className="mt-3 text-sm font-semibold">{name}</p>
          <p className="text-sm text-[#2a1d2e]/65">Web developer, MMRC 26</p>
        </div>
      </div>
    </article>
  );
}

/**
 * The credits: the site's own credit, told the way the competition is.
 * A mouse runs a maze, and the developer is what it finds in the centre.
 * Then the developer's letter.
 *
 * Dark in either theme, like a cinema with the lights down.
 */
export function CreditsScene({ maze, name, role, linkedIn, stats, started, lines, paragraphs }: CreditsProps) {
  const [arrived, setArrived] = useState(false);

  return (
    <section aria-labelledby="credits-title" className="relative isolate overflow-hidden bg-[#120a18] px-4 py-24 text-white sm:py-28">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_0%,rgba(134,38,51,0.35),transparent_70%),radial-gradient(50%_40%_at_80%_90%,rgba(95,33,103,0.45),transparent_70%)]"
      />
      <div className="mx-auto max-w-6xl">
        <p className="text-center font-mono text-xs uppercase tracking-[0.35em] text-white/55">Credits</p>
        <h2 id="credits-title" className="mt-4 text-center font-display text-3xl font-extrabold sm:text-4xl">
          Who made this site
        </h2>

        <dl className="mx-auto mt-12 grid max-w-xl gap-y-3 text-sm">
          {lines.map((line) => (
            <div key={line.role} className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-4">
              <dt className="text-right uppercase tracking-[0.18em] text-white/50">{line.role}</dt>
              <span aria-hidden="true" className="h-px w-8 self-center bg-white/20" />
              <dd className="font-semibold text-white/90">{line.name}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-16 grid items-center gap-14 lg:grid-cols-2">
          <MazeRun maze={maze} onArrive={() => setArrived(true)} />

          <div className="text-center lg:text-left">
            <p className="flex items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-white/60 lg:justify-start">
              <span aria-hidden="true" className="h-px w-6 bg-white/30" />
              Website engineered by
              <span aria-hidden="true" className="h-px w-6 bg-white/30" />
            </p>
            <p
              className={`mt-5 font-display text-4xl font-extrabold uppercase tracking-[0.12em] transition-colors duration-700 motion-reduce:transition-none sm:text-5xl ${arrived ? "text-white" : "text-white/40"}`}
            >
              <DecodedName name={name} arrived={arrived} />
            </p>
            <p className={`mt-4 text-white/70 transition-opacity duration-700 motion-reduce:transition-none ${arrived ? "opacity-100" : "opacity-0"}`}>
              {role}, from the first line in {started} to the final.
            </p>

            <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] bg-white/10 text-left sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <li key={stat.label} className="bg-[#120a18] p-4">
                  <span className="block font-display text-2xl font-extrabold tabular-nums" style={{ color: MAZE_GOLD }}>
                    <CountUp value={stat.value} approx={stat.approx} run={arrived} />
                  </span>
                  <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-white/55">{stat.label}</span>
                </li>
              ))}
            </ul>

            <a
              href={linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-8 inline-flex items-center gap-2.5 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Say hello on LinkedIn
              <span className="sr-only">, opens in a new tab</span>
            </a>
          </div>
        </div>

        <Letter name={name} paragraphs={paragraphs} />
      </div>
    </section>
  );
}
