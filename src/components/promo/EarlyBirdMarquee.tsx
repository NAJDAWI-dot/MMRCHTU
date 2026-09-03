import { EARLY_BIRD_LABEL_AR } from "@/lib/early-bird";

/** Enough repeats that one copy of the track overruns the widest viewport. */
const REPEATS = 10;

/**
 * The scrolling discount ribbon across the top of the register page.
 *
 * Two identical copies of the same run of words sit side by side in one flex
 * track, and the track slides by exactly half its own width. At the end of the
 * cycle the second copy has landed precisely where the first began, so the loop
 * restarts with nothing to see — the seam that a single copy would show as it
 * wrapped never exists. The motion itself is in globals.css.
 *
 * It travels rightward, which is the mirror of a conventional ticker and the
 * right way round for Arabic: the words arrive from the side the reader is
 * coming from rather than the side they are heading towards.
 *
 * Everything visible is aria-hidden. A screen reader has no use for the same
 * word ten times, so the offer is stated once, plainly, in text only it sees;
 * the notice underneath carries the terms.
 */
export function EarlyBirdMarquee() {
  const run = Array.from({ length: REPEATS }, (_, i) => i);

  return (
    <div className="relative overflow-hidden border-y border-white/15 bg-gradient-to-r from-ras-crimson via-mood-garnet to-ras-crimson py-2">
      <p className="sr-only">An early bird discount is currently running on registration.</p>

      <div aria-hidden="true" className="eb-marquee-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {run.map((i) => (
              <span key={i} className="flex shrink-0 items-center gap-6 px-6">
                <span dir="rtl" lang="ar" className="font-arabic text-sm font-bold text-white">
                  {EARLY_BIRD_LABEL_AR}
                </span>
                <span className="text-xs text-white/45">&#9733;</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
