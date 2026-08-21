/*
  Offline support for MMRC 26.

  The manifest already declared `display: standalone`, so the site could be
  installed to a home screen — and then showed the browser's dinosaur the
  moment the venue wifi dropped. Competition day, in a hall full of phones, is
  exactly when the schedule and the rules are wanted and the network is worst.

  Deliberately conservative. A service worker is the one thing on a site that
  can outlive a bad deploy: it sits between every request and the network, and
  a caching bug serves stale pages until someone clears their browser. So:

    * Pages are network-first. Cache is a fallback for being offline, never a
      substitute for being online, and nobody sees yesterday's schedule while
      connected.
    * Only fingerprinted build assets are cache-first, because /_next/static
      filenames change whenever their contents do — they cannot go stale.
    * Caches are stamped with VERSION and every other cache is deleted on
      activate, so a new deploy cannot inherit the last one's mistakes.
    * Nothing under /api or /admin is touched at all.

  Bump VERSION to force every client to discard what it has.
*/

const VERSION = "v1";
const STATIC_CACHE = `mmrc-static-${VERSION}`;
const PAGE_CACHE = `mmrc-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Individually, so one missing file cannot fail the whole install and
      // leave the worker permanently unactivated.
      await Promise.allSettled(
        [OFFLINE_URL, "/site.webmanifest", "/brand/favicon/favicon.ico"].map((url) =>
          cache.add(url),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key)),
      );
      // Take over open tabs immediately rather than waiting for them to close,
      // so a fix ships on the next page load instead of the next session.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Same-origin only: the blob store serves gallery photos and has its own
  // caching, and nothing good comes of a service worker second-guessing it.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;

  if (request.mode === "navigate") {
    event.respondWith(pageWithOfflineFallback(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(cacheFirst(request));
  }
});

/** Network first; the cache exists only for when the network is not there. */
async function pageWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    // A 503 rather than a 200: this is not the page that was asked for, and
    // saying so keeps it out of anything that caches by status.
    return offline ?? new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

/** Safe only for immutable, fingerprinted URLs. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}
