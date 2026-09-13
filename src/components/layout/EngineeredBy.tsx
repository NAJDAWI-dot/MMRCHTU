/**
 * The engineering credit that closes every page.
 *
 * It used to be the word NAJDAWI, centred, saying nothing about what it was
 * for and leading nowhere. A credit that cannot be followed is decoration, so
 * this one names the role and carries the person's profile.
 *
 * The whole lockup is one link rather than a line of text with a link inside
 * it. Two reasons: the label and the wordmark are one credit and should not be
 * separately tabbable, and a target this small needs the generous hit area
 * that wrapping both lines in the anchor gives it.
 *
 * Every moving part here is a transform or a colour — nothing animates a
 * layout property, so the strip cannot reflow the page it sits under — and
 * each one is switched off under `prefers-reduced-motion`, as everywhere else
 * on this site.
 */

const LINKEDIN_URL = "https://www.linkedin.com/in/hashemnajdawi/";

/**
 * The LinkedIn badge, inlined.
 *
 * An icon font or a remote asset for one 14px mark would be a network request
 * on every page of the site; the path is 700 bytes and ships with the markup.
 */
function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function EngineeredBy() {
  return (
    <div className="border-t border-ras-gray/10 px-4 py-6 text-center">
      <a
        href={LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex flex-col items-center gap-2 rounded-lg px-5 py-2 transition-colors duration-200 hover:bg-ras-purple/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/50 motion-reduce:transition-none dark:hover:bg-white/[0.06] dark:focus-visible:ring-white/60"
      >
        {/* The label, held between two hairlines that draw outwards on hover —
            a corridor opening, which is the one visual idea this whole site is
            built on. They scale rather than change width: a width transition
            here would push the label around mid-hover. */}
        <span className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-ras-gray dark:text-white/65">
          <span
            aria-hidden="true"
            className="h-px w-5 origin-right bg-ras-gray/40 transition-transform duration-300 group-hover:scale-x-150 motion-reduce:transition-none dark:bg-white/30"
          />
          Engineered by
          <span
            aria-hidden="true"
            className="h-px w-5 origin-left bg-ras-gray/40 transition-transform duration-300 group-hover:scale-x-150 motion-reduce:transition-none dark:bg-white/30"
          />
        </span>

        <span className="relative flex items-center">
          {/* The padding answers the letter-spacing: tracking adds its space
              after the final letter too, so without it the wordmark sits half
              a space left of centre under the label above. */}
          <span className="ps-[0.35em] font-display text-base font-extrabold tracking-[0.35em] text-ras-purple transition-colors duration-200 group-hover:text-accent motion-reduce:transition-none dark:text-white/85 dark:group-hover:text-white">
            NAJDAWI
          </span>

          {/* Hung outside the line rather than sitting in it, so the name — not
              the name plus a badge — is what centres under the label. Quiet
              until the link is pointed at: it is a signpost, not a logo the
              chapter is displaying. */}
          <LinkedInMark className="absolute left-full top-1/2 ml-2 h-3 w-3 -translate-y-1/2 text-ras-gray/45 transition-colors duration-200 group-hover:text-accent motion-reduce:transition-none dark:text-white/40 dark:group-hover:text-white" />

          {/* Drawn on hover rather than always present: an underline under a
              wordmark reads as part of the wordmark, and this one is meant to
              read as "this is a link". */}
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-accent/60 transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none dark:bg-white/60"
          />
        </span>

        {/* Spoken, not shown. The visible words are the start of the accessible
            name rather than a replacement for it, so voice control still
            reaches this link by what a person can actually see — which an
            aria-label saying something else would quietly break. */}
        <span className="sr-only">, Hashem Najdawi on LinkedIn, opens in a new tab</span>
      </a>
    </div>
  );
}
