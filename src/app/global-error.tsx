"use client";

import { useEffect } from "react";

/**
 * The last resort: an error thrown by the root layout itself.
 *
 * `error.tsx` sits inside the layout, so it cannot catch a failure in the
 * layout that renders it — the header's database call, the theme provider, the
 * fonts. This one replaces the whole document instead, which is why it has to
 * ship its own <html> and <body>.
 *
 * Deliberately styled inline and dependency-free. Anything it imported might be
 * the thing that just failed, and Tailwind's stylesheet is loaded by the layout
 * that is not rendering.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#57565B",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#5F2167" }}>MMRC 26 is having a moment</h1>
        <p style={{ margin: 0, maxWidth: "32rem" }}>
          The site failed to load. This is almost always temporary — please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 44,
            padding: "0 1.25rem",
            border: "none",
            borderRadius: 6,
            background: "#5F2167",
            color: "#ffffff",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>Reference: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
