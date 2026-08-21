"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker.
 *
 * Production only, and deliberately so: in development a worker sitting in
 * front of every request fights hot reloading, and a stale cached module is a
 * confusing way to spend an afternoon. Registering it here rather than in a
 * script tag also means it never runs before the page is interactive.
 *
 * Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // After load, so registering never competes with the first paint for
    // bandwidth on the connection this exists to compensate for.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Blocked by a private window or an enterprise policy. The site works
        // exactly as before without it, so this is a note rather than an error.
        console.info("Service worker not registered", error);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
