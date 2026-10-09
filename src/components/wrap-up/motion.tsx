"use client";

import { useEffect, useRef, useState } from "react";

/** Whether the visitor has asked for less motion. Client only. */
export function prefersStill(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs `step` with 0..1 over `ms`, and `done` at the end. Returns a cancel. */
export function tween(ms: number, step: (t: number) => void, done?: () => void): () => void {
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

/** True once, the first time the element is well into view. */
export function useSeen<T extends Element>(threshold = 0.45) {
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

/** A number counting up from nothing once `run` turns true. The final value is rendered on the server. */
export function CountUp({ value, approx, run, ms = 1400 }: { value: number; approx?: boolean; run: boolean; ms?: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (prefersStill()) return;
    if (!run) {
      setShown(0);
      return;
    }
    return tween(ms, (t) => setShown(Math.round(value * (1 - Math.pow(1 - t, 3)))));
  }, [run, value, ms]);
  return (
    <>
      {new Intl.NumberFormat("en-GB").format(shown)}
      {approx ? "+" : ""}
    </>
  );
}

/** A number that counts up when it scrolls into view. */
export function CountOnView({ value, className }: { value: number; className?: string }) {
  const [ref, seen] = useSeen<HTMLSpanElement>(0.6);
  return (
    <span ref={ref} className={className}>
      <CountUp value={value} run={seen} ms={1200} />
    </span>
  );
}

const CONFETTI = ["#f2a900", "#f2c14e", "#e0526e", "#ffd8e6", "#ffffff", "#c39bd3"];

/**
 * A burst of confetti from one point, once, drawn on a canvas laid over its
 * parent (which must be positioned). Gone after three seconds; never drawn
 * under reduced motion.
 */
export function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element || prefersStill()) {
      setDone(true);
      return;
    }
    const context = element.getContext("2d");
    if (!context) return;
    const box = element.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    element.width = box.width * ratio;
    element.height = box.height * ratio;
    context.scale(ratio, ratio);

    const pieces = Array.from({ length: 150 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const speed = 4 + Math.random() * 9;
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 6,
        turn: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)]!,
        ribbon: Math.random() < 0.4,
      };
    });

    return tween(
      3000,
      (t) => {
        context.clearRect(0, 0, box.width, box.height);
        context.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        for (const piece of pieces) {
          piece.vy += 0.22;
          piece.vx *= 0.985;
          piece.vy *= 0.985;
          piece.x += piece.vx;
          piece.y += piece.vy;
          piece.turn += piece.spin;
          context.save();
          context.translate(piece.x, piece.y);
          context.rotate(piece.turn);
          context.fillStyle = piece.color;
          if (piece.ribbon) context.fillRect(-piece.size / 2, -1, piece.size, 2.4 * Math.abs(Math.cos(piece.turn * 2)) + 0.6);
          else context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * Math.abs(Math.sin(piece.turn)) + 1);
          context.restore();
        }
      },
      () => setDone(true),
    );
  }, [x, y]);

  if (done) return null;
  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full" />;
}
