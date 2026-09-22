"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** A minute: as often as the page itself is regenerated, so no refresh is wasted. */
const EVERY_MS = 60_000;

/**
 * Keeps the day site current on a phone left open in the hall.
 *
 * router.refresh() rather than a reload: it fetches the page's server output
 * again and swaps it in place, keeping the scroll position and any open menu.
 * It reads the same cached copy every other visitor gets, so a hall of phones
 * refreshing costs the database nothing extra.
 *
 * Paused while the tab is hidden, and caught up the moment it comes back, so a
 * phone in a pocket does not refresh all afternoon for nobody.
 */
export function DayAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), EVERY_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
