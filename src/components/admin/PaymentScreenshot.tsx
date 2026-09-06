"use client";

import { useState } from "react";

/**
 * One team's proof-of-payment screenshot, shown in place on the payments list.
 *
 * The point is that verifying a payment should not mean leaving the page, and
 * certainly not collecting a folder of strangers' bank receipts on disk. The
 * amount and the reference to check it against are a few lines above; the
 * picture belongs next to them.
 *
 * Nothing is requested until the admin asks. The route behind this is
 * force-dynamic and sends no-store, so every render is a fresh proxied fetch
 * from blob storage — mounting an <img> for each of fifty registrations at once
 * would be fifty of those on page load, for images almost all of which nobody
 * is looking at. `loading="lazy"` would not help, since the point at which they
 * become visible is exactly the point at which the list is scrolled.
 */

interface PaymentScreenshotProps {
  registrationId: string;
  teamName: string;
  /** Rendered beside the control, e.g. when the team said they paid. */
  reportedOn?: string;
  /**
   * Show the picture immediately instead of behind the toggle.
   *
   * False on the list, where mounting fifty proxied fetches on page load would
   * be fifty private-document requests for images nobody is looking at. True in
   * the review queue, where there is exactly one and it is the reason you are
   * on the page.
   */
  defaultOpen?: boolean;
}

export function PaymentScreenshot({
  registrationId,
  teamName,
  reportedOn,
  defaultOpen = false,
}: PaymentScreenshotProps) {
  const [shown, setShown] = useState(defaultOpen);
  const [failed, setFailed] = useState(false);

  const src = `/admin/payments/screenshot/${registrationId}`;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-expanded={shown}
          className="font-semibold text-ras-purple underline transition-colors hover:text-mood-plum dark:text-white dark:hover:text-white/80"
        >
          {shown ? "Hide payment screenshot" : "View payment screenshot"}
        </button>
        {reportedOn ? (
          <span className="text-ras-gray dark:text-white/50">reported {reportedOn}</span>
        ) : null}
      </div>

      {shown ? (
        <div className="mt-2">
          {failed ? (
            // Older uploads may be stored under a type the route will not render
            // inline, and a proxied fetch can simply fail. Either way the admin
            // is told which it was and still has a way to the file.
            <p className="rounded-md border border-ras-crimson/30 bg-ras-crimson/5 p-3 text-xs text-ras-gray dark:text-white/70">
              This screenshot could not be displayed here. Download it instead:{" "}
              <a
                href={`${src}?download=1`}
                className="font-semibold text-accent underline"
              >
                {teamName} payment screenshot
              </a>
              .
            </p>
          ) : (
            <>
              {/*
                A plain <img>: next/image would want to optimise and cache a
                one-off private document, which is the whole thing this route
                exists to prevent. max-h keeps a tall phone screenshot from
                pushing the rest of the card off the screen; clicking opens it
                at full size.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element -- private, no-store proxy; must not be optimised or cached */}
              <img
                src={src}
                alt={`Proof of payment uploaded by ${teamName}`}
                onError={() => setFailed(true)}
                className="max-h-[28rem] w-auto max-w-full rounded-md border border-ras-gray/25 bg-white object-contain dark:border-white/15"
              />
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ras-purple underline dark:text-white/80"
                >
                  Open full size ↗
                </a>
                <a href={`${src}?download=1`} className="text-ras-gray underline dark:text-white/60">
                  Download
                </a>
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
