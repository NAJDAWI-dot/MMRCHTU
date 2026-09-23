"use client";

import { useEffect, useRef, useState } from "react";
import { MouseMark } from "@/components/brand/MouseMark";

const SEEN_KEY = "mmrc26-day-splash";
/** When the flag has finished wiping it away, in CSS. */
const DONE_MS = 3900;

/**
 * The day site's intro: a race start.
 *
 * The chapter presents; five lights come on one at a time and go out together;
 * MMRC 26 arrives with a mouse streaking under it; a chequered flag wipes the
 * screen up and away. Once per browser session, and any click or key skips it.
 *
 * All the timing is CSS, and so is the exit: the overlay hides itself at the
 * end with no help from this component, so it can never be left over the page
 * by a script that failed. The script only skips, remembers, and removes.
 * A pre-paint line in the layout hides it before it is drawn on a visit that
 * has already seen it.
 */
export function DaySplash() {
  const [state, setState] = useState<"running" | "leaving" | "gone">("running");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage refused: it plays, and plays again next time. Harmless.
    }
    if (seen) {
      setState("gone");
      return;
    }
    const done = window.setTimeout(() => setState("gone"), DONE_MS);
    const skip = () => {
      window.clearTimeout(done);
      setState("leaving");
      window.setTimeout(() => setState("gone"), 650);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") skip();
    };
    const node = ref.current;
    node?.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(done);
      node?.removeEventListener("click", skip);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (state === "gone") return null;

  return (
    <div
      ref={ref}
      className="day-splash"
      data-leaving={state === "leaving" ? "true" : undefined}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex w-full max-w-3xl flex-col items-center px-6 text-center">
        <div className="day-splash-chapter flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo/lockup-htu-chapter-white.png" alt="" width={56} height={56} className="h-14 w-14" />
          <span className="text-left">
            <span className="day-wide block text-[11px] font-bold uppercase tracking-[0.28em] text-[#faf2e6]/70">
              IEEE RAS HTU Student Chapter
            </span>
            <span className="block text-sm text-[#faf2e6]/55">presents</span>
          </span>
        </div>

        <div className="day-splash-lights mt-12 rounded-[1.6rem] border border-white/10 bg-black/40 p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
          <div className="flex gap-3 sm:gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl bg-[#1a0b1f] p-2">
                <span className="day-splash-light block h-9 w-9 rounded-full sm:h-12 sm:w-12" style={{ ["--i" as string]: i }} />
                <span className="block h-9 w-9 rounded-full bg-[#2b1531] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] sm:h-12 sm:w-12" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-12 w-full">
          <p className="day-splash-name font-brand text-6xl leading-none text-[#faf2e6] sm:text-8xl">MMRC 26</p>
          <p className="day-splash-name day-wide mt-4 text-sm font-bold uppercase tracking-[0.42em] text-[#ffb3c2] sm:text-base">
            Competition day
          </p>
          <div className="relative mx-auto mt-8 h-2 w-full max-w-md overflow-hidden rounded-full">
            <div className="day-splash-streak day-stripe-x absolute inset-0 rounded-full" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-[-6px] h-6 overflow-hidden">
            <MouseMark className="day-splash-mouse absolute h-6 w-6 text-[#faf2e6]" />
          </div>
        </div>

        <p className="mt-14 text-xs text-[#faf2e6]/45">Tap to skip</p>
      </div>

      <div className="day-splash-flag day-checker" style={{ ["--size" as string]: "22px", color: "#faf2e6", ["--day-ink" as string]: "250 242 230" }} />
    </div>
  );
}

/** Runs before the page paints: hides the splash for a visit that has seen it. */
export const DAY_SPLASH_SCRIPT = `try{if(sessionStorage.getItem("${SEEN_KEY}")==="1")document.documentElement.classList.add("day-splash-seen")}catch(e){}`;
