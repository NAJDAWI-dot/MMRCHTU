"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * The day site's artwork, redrawn from the main site's poster background.
 *
 * The same pieces in the same corners (the maze top left, the rings top right,
 * the running-track arcs bottom left, the chequered flag bottom right, stars and
 * halftone dots between them), drawn as vectors so they stay sharp at any
 * size, take their inks from the theme, and move at their own depth as the
 * page scrolls. A noise mask wears their edges like the printed original.
 *
 * Fixed behind everything and hidden from assistive technology: decoration.
 */

function star(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${points.join("L")}Z`;
}

/** A halftone patch: a grid of dots shrinking away from one corner. */
function Halftone({ size, fill, fade = "tl" }: { size: number; fill: string; fade?: "tl" | "br" }) {
  const step = 14;
  const count = Math.floor(size / step);
  const dots: { x: number; y: number; r: number }[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const dx = fade === "tl" ? col : count - 1 - col;
      const dy = fade === "tl" ? row : count - 1 - row;
      const d = Math.hypot(dx, dy) / count;
      const r = (1 - d) * 5.2;
      if (r > 0.6) dots.push({ x: col * step + (row % 2 ? step / 2 : 0), y: row * step, r });
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`}>
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} style={{ fill }} />
      ))}
    </svg>
  );
}

const MAZE = [
  "M0 40 H120 V110 H60 V180",
  "M160 0 V70 H250 V150 H190",
  "M40 230 H150 V300 H90 V380",
  "M200 200 H300 V120 H360",
  "M300 260 V340 H220 V420",
  "M0 300 H40",
  "M110 440 H200 V520",
  "M260 470 H360 V380",
  "M20 400 V500",
];

const STARS: { x: string; y: string; s: number; tone: string; i: number }[] = [
  { x: "22%", y: "5%", s: 22, tone: "var(--art-crimson)", i: 0 },
  { x: "23%", y: "15%", s: 16, tone: "var(--art-deep)", i: 1 },
  { x: "76%", y: "5%", s: 26, tone: "var(--art-plum)", i: 2 },
  { x: "78%", y: "15%", s: 18, tone: "var(--art-deep)", i: 3 },
  { x: "86%", y: "36%", s: 18, tone: "var(--art-crimson)", i: 4 },
  { x: "12%", y: "74%", s: 26, tone: "var(--art-deep)", i: 5 },
  { x: "19%", y: "81%", s: 16, tone: "var(--art-crimson)", i: 6 },
  { x: "89%", y: "73%", s: 16, tone: "var(--art-crimson)", i: 7 },
  { x: "84%", y: "80%", s: 22, tone: "var(--art-rose)", i: 8 },
];

const at = (depth: number, style: CSSProperties): CSSProperties => ({ ...style, ["--depth" as string]: depth });

export function DayBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty("--day-y", `${-window.scrollY}px`);
      document.documentElement.style.setProperty("--day-progress", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="day-backdrop" aria-hidden="true">
      {/* The maze, top left. */}
      <div className="day-art day-worn" style={at(0.12, { left: "-3%", top: "-5%", width: "clamp(150px, 20vw, 360px)", aspectRatio: "420 / 540", opacity: 0.32 })}>
        <svg viewBox="0 0 420 540">
          <g fill="none" style={{ stroke: "rgb(var(--art-rose))" }} strokeWidth="18" strokeLinecap="square" strokeLinejoin="miter">
            {MAZE.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </svg>
      </div>

      {/* The rings, top right, with a dashed orbit turning slowly inside. */}
      <div className="day-art day-worn" style={at(0.2, { right: "clamp(-220px, -10vw, -90px)", top: "clamp(-240px, -14vw, -110px)", width: "clamp(260px, 32vw, 560px)", aspectRatio: "1" })}>
        <svg viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="180" fill="none" style={{ stroke: "rgb(var(--art-crimson))" }} strokeWidth="34" />
          <circle cx="200" cy="200" r="132" fill="none" style={{ stroke: "rgb(var(--art-deep))" }} strokeWidth="34" />
          <circle cx="200" cy="200" r="86" fill="none" style={{ stroke: "rgb(var(--art-plum) / 0.8)" }} strokeWidth="22" />
          <g className="day-spin">
            <circle cx="200" cy="200" r="58" fill="none" style={{ stroke: "rgb(var(--art-rose) / 0.8)" }} strokeWidth="4" strokeDasharray="6 12" />
          </g>
        </svg>
      </div>

      {/* Halftone, right edge. */}
      <div className="day-art" style={at(0.28, { right: "-1%", top: "34%", width: "clamp(110px, 12vw, 200px)", aspectRatio: "1", opacity: 0.5 })}>
        <Halftone size={200} fill="rgb(var(--art-rose))" fade="br" />
      </div>

      {/* The running-track arcs, bottom left. */}
      <div className="day-art day-worn" style={at(-0.1, { left: "clamp(-120px, -6vw, -40px)", bottom: "clamp(-200px, -12vw, -90px)", width: "clamp(260px, 34vw, 620px)", aspectRatio: "620 / 360" })}>
        <svg viewBox="0 0 620 360">
          <g fill="none" strokeWidth="42">
            <path d="M0 330 H330 A210 210 0 0 1 540 540" style={{ stroke: "rgb(var(--art-plum))" }} transform="translate(0,-150)" />
            <path d="M0 372 H330 A168 168 0 0 1 498 540" style={{ stroke: "rgb(var(--art-deep))" }} transform="translate(0,-150)" />
            <path d="M0 414 H330 A126 126 0 0 1 456 540" style={{ stroke: "rgb(var(--art-crimson))" }} transform="translate(0,-150)" />
          </g>
        </svg>
      </div>

      {/* Halftone, bottom left. */}
      <div className="day-art" style={at(0.06, { left: "0.5%", bottom: "18%", width: "clamp(90px, 10vw, 170px)", aspectRatio: "1", opacity: 0.55 })}>
        <Halftone size={170} fill="rgb(var(--art-deep))" />
      </div>

      {/* The chequered flag, bottom right. */}
      <div className="day-art day-worn" style={at(-0.16, { right: "clamp(-160px, -8vw, -60px)", bottom: "clamp(-160px, -8vw, -60px)", width: "clamp(200px, 22vw, 380px)", aspectRatio: "1" })}>
        <svg viewBox="0 0 300 300">
          <g transform="rotate(-45 150 150) translate(0 90)">
            {Array.from({ length: 4 }, (_, row) =>
              Array.from({ length: 10 }, (_, col) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * 30 - 0}
                  y={row * 30}
                  width="30"
                  height="30"
                  style={{ fill: (row + col) % 2 ? "rgb(var(--art-sand))" : "rgb(var(--art-rose))" }}
                />
              )),
            )}
          </g>
        </svg>
      </div>

      {/* Stars, twinkling in turn. */}
      {STARS.map((s) => (
        <div
          key={s.i}
          className="day-art"
          style={at(0.1 + (s.i % 4) * 0.05, { left: s.x, top: s.y, width: s.s, height: s.s })}
        >
          <svg viewBox="-12 -12 24 24">
            <path className="day-twinkle" style={{ ["--i" as string]: s.i, fill: `rgb(${s.tone})` }} d={star(0, 0, 11)} />
          </svg>
        </div>
      ))}

      <div className="day-grain" />
    </div>
  );
}
