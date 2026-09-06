"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { MazeTrail } from "@/components/brand/MazeTrail";
import { MmrcLogo } from "@/components/brand/MmrcLogo";
import type { MazeTiming } from "@/lib/maze";
import {
  SPLASH_DONE_CLASS,
  SPLASH_FADE_MS,
  SPLASH_PENDING_CLASS,
  SPLASH_READY_CLASS,
  splashHoldMs,
  splashMode,
} from "@/lib/splash";

/**
 * Full-screen intro, shown on every load of the document.
 *
 * The markup here renders identically on the server every time and starts
 * hidden in CSS; a pre-paint script in <head> decides whether to reveal it.
 * So this component never decides *whether* to show — only when to take it
 * down. That split is what avoids both a hydration mismatch and a frame of
 * the real page showing through.
 *
 * How long it stays up is not a constant, because the maze is not a constant:
 * a fresh one is generated on every visit and the mice run it at a fixed pace,
 * so a longer carve takes longer to run. MazeTrail reports its own timing and
 * this schedules against that, rather than the two agreeing on a number that
 * could quietly drift apart.
 */
export function SplashScreen() {
  const [timing, setTiming] = useState<MazeTiming | null>(null);

  // The maze is generated once, but React may invoke this callback from a
  // remount in development. Keeping it stable stops it re-running generation.
  const handleReady = useCallback((next: MazeTiming) => setTiming(next), []);

  // Survives the effect re-running when the timing arrives, so the overlay is
  // never torn down twice or resurrected after it has gone.
  const finishedRef = useRef(false);

  /**
   * The fade-out, held outside the effect on purpose.
   *
   * It used to be a local, which meant the effect's cleanup cleared it — and
   * that is a trap once someone skips before the maze has reported its timing:
   * `finish` runs and schedules the fade, the report then arrives and re-runs
   * the effect, the cleanup cancels the fade, and the new run returns early
   * because it has already finished. Nothing is left to take the classes off,
   * so the overlay stays on <html> at opacity zero, invisible but covering the
   * whole page and swallowing every click. A ref outlives the re-run.
   */
  const fadeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains(SPLASH_PENDING_CLASS)) return;
    if (finishedRef.current) return;

    const mode = splashMode({
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      root.classList.add(SPLASH_DONE_CLASS);
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(() => {
        root.classList.remove(SPLASH_PENDING_CLASS, SPLASH_DONE_CLASS);
      }, SPLASH_FADE_MS);
    };

    // Scheduled immediately with the fallback, then rescheduled a frame later
    // when the maze reports. Waiting for the report instead would strand a
    // visitor on a purple screen if generation ever threw.
    const holdTimer = window.setTimeout(
      finish,
      splashHoldMs(mode, timing?.totalMs),
    );

    // Any deliberate input skips ahead — nobody should be held on an intro.
    const skip = () => {
      window.clearTimeout(holdTimer);
      finish();
    };
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });

    return () => {
      window.clearTimeout(holdTimer);
      // The fade timer is deliberately left running — see fadeTimerRef. It is
      // the only thing that takes the overlay off the page.
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      // Deliberately does NOT clear the pending class. StrictMode mounts,
      // unmounts and remounts this in development; clearing here would leave
      // the second mount with no class to find, so it would bail out and the
      // splash would vanish instantly.
      // Nothing needs the cleanup anyway — this lives in the root layout,
      // which never unmounts during client navigation.
    };
  }, [timing]);

  return (
    <div
      id="mmrc-splash"
      data-testid="splash"
      // Decorative and self-dismissing: announcing it would interrupt a screen
      // reader before it reaches the real page content.
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[#3f1546] bg-[radial-gradient(circle_at_50%_40%,#5f2167_0%,#3f1546_60%,#2a0e2f_100%)] text-white${
        timing ? ` ${SPLASH_READY_CLASS}` : ""
      }`}
      style={
        timing
          ? ({ "--lockup-at": `${timing.lockupS.toFixed(2)}s` } as CSSProperties)
          : undefined
      }
    >
      <MazeTrail size={280} className="splash-maze text-white" motion="run" onReady={handleReady} />

      <div className="splash-lockup flex flex-col items-center gap-3 px-6 text-center">
        {/*
          Both marks, side by side, the way the header carries them. The MMRC
          mark keeps its plate here too — the splash is deep purple, and the
          white half of the glyph would be the only half that survived on it.
        */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset, must paint immediately */}
          <img
            src="/brand/logo/lockup-htu-chapter-white.png"
            alt=""
            width={200}
            height={197}
            className="h-auto w-[104px]"
          />
          <span aria-hidden="true" className="h-12 w-px shrink-0 bg-white/30" />
          <MmrcLogo markOnly size="h-16" />
        </div>
        <p className="font-brand text-2xl uppercase tracking-[0.14em] text-white">
          MMRC 26
        </p>
        <p className="text-xs uppercase tracking-[0.28em] text-[#f2a900]">
          Micro Mouse Robot Competition
        </p>
      </div>
    </div>
  );
}
