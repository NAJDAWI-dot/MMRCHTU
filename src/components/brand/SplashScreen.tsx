"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { MazeTrail } from "@/components/brand/MazeTrail";
import type { MazeTiming } from "@/lib/maze";
import {
  SPLASH_DONE_CLASS,
  SPLASH_FADE_MS,
  SPLASH_PENDING_CLASS,
  SPLASH_READY_CLASS,
  SPLASH_SESSION_KEY,
  splashHoldMs,
  splashMode,
} from "@/lib/splash";

/**
 * Full-screen intro shown once per tab.
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

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains(SPLASH_PENDING_CLASS)) return;
    if (finishedRef.current) return;

    const mode = splashMode({
      seen: false, // the pre-paint script already ruled this out
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });

    let fadeTimer: number | undefined;

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      // Recording it here rather than on mount means a visitor who closes the
      // tab mid-animation still gets the intro next time.
      try {
        sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
      } catch {
        // Private modes can refuse storage. Worst case the splash replays;
        // that must not take the page down with it.
      }
      root.classList.add(SPLASH_DONE_CLASS);
      fadeTimer = window.setTimeout(() => {
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
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      // Deliberately does NOT clear the pending class. StrictMode mounts,
      // unmounts and remounts this in development; clearing here would leave
      // the second mount with no class to find, so it would bail out and the
      // splash would vanish instantly without ever recording the session flag.
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
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset, must paint immediately */}
        <img
          src="/brand/logo/lockup-htu-chapter-white.png"
          alt=""
          width={200}
          height={197}
          className="h-auto w-[132px]"
        />
        <p className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-white">
          MMRC 26
        </p>
        <p className="text-xs uppercase tracking-[0.28em] text-[#f2a900]">
          Micro Mouse Robot Competition
        </p>
      </div>
    </div>
  );
}
