"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Cheddar } from "@/components/brand/Cheddar";
import {
  ROUTE_LOADER_FADE_MS,
  ROUTE_LOADER_SAFETY_MS,
  remainingHoldMs,
  shouldInterceptClick,
} from "@/lib/route-loader";

/**
 * The curtain between pages.
 *
 * Next 14 publishes no navigation events, so this cannot ask the router when a
 * navigation begins — it watches for the click that starts one, in the capture
 * phase so it sees the event before `<Link>` does, and then waits for
 * `usePathname` to change.
 *
 * The wait has a floor. These pages render in single-digit milliseconds, so
 * hiding as soon as the path changed would show a flicker rather than a
 * transition; `remainingHoldMs` keeps the loader up for the rest of the minimum
 * once the page is already there. It is a minimum and never an addition — a
 * genuinely slow route hides the moment it arrives.
 *
 * State lives in a ref as well as in `useState` because the click listener is
 * registered once and would otherwise close over a stale value forever.
 */
export function RouteLoader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"hidden" | "showing" | "leaving">("hidden");

  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const hide = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setPhase("leaving");
    timersRef.current.push(window.setTimeout(() => setPhase("hidden"), ROUTE_LOADER_FADE_MS));
  }, [clearTimers]);

  const show = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    clearTimers();
    // performance.now() rather than Date.now(): this measures an interval, and
    // it must not be affected by the system clock being corrected mid-navigation.
    startedAtRef.current = performance.now();
    setPhase("showing");
    // Nothing may leave the site behind a curtain it cannot lift: a cancelled
    // or failed navigation never changes the path, so without this the overlay
    // would simply stay.
    timersRef.current.push(window.setTimeout(hide, ROUTE_LOADER_SAFETY_MS));
  }, [clearTimers, hide]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      // Read location rather than the hook's value: this listener is attached
      // once and its closure would otherwise hold the path from first render.
      const intercept = shouldInterceptClick(
        {
          href: anchor.href,
          target: anchor.target,
          download: anchor.hasAttribute("download"),
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        window.location.pathname,
        window.location.origin,
      );
      if (intercept) show();
    };

    // Back and forward deserve the same beat as a link.
    const onPopState = () => show();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [show, clearTimers]);

  // The new route has arrived. Serve out the rest of the hold, if any.
  useEffect(() => {
    if (!activeRef.current) return;
    clearTimers();
    timersRef.current.push(
      window.setTimeout(hide, remainingHoldMs(startedAtRef.current, performance.now())),
    );
  }, [pathname, hide, clearTimers]);

  if (phase === "hidden") return null;

  return (
    <div
      className={`route-loader${phase === "leaving" ? " route-loader-leaving" : ""}`}
      // Decorative and self-dismissing, like the splash: announcing it would
      // interrupt a screen reader on its way to the page that is already here.
      aria-hidden="true"
    >
      <div className="route-loader-stage">
        <Cheddar size={96} pose="run" className="route-loader-cheddar" />
        <span className="route-loader-track" />
      </div>
    </div>
  );
}
