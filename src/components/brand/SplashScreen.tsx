"use client";

import { useEffect } from "react";
import { MazeTrail } from "@/components/brand/MazeTrail";
import {
  SPLASH_DONE_CLASS,
  SPLASH_FADE_MS,
  SPLASH_PENDING_CLASS,
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
 */
export function SplashScreen() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains(SPLASH_PENDING_CLASS)) return;

    const mode = splashMode({
      seen: false, // the pre-paint script already ruled this out
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });

    let fadeTimer: number | undefined;

    const finish = () => {
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

    const holdTimer = window.setTimeout(finish, splashHoldMs(mode));

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
  }, []);

  return (
    <div
      id="mmrc-splash"
      data-testid="splash"
      // Decorative and self-dismissing: announcing it would interrupt a screen
      // reader before it reaches the real page content.
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[#3f1546] bg-[radial-gradient(circle_at_50%_40%,#5f2167_0%,#3f1546_60%,#2a0e2f_100%)] text-white"
    >
      <MazeTrail size={168} className="text-white" motion="run" />

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
