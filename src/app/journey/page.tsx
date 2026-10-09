import type { Metadata } from "next";
import { JourneyTour } from "@/components/wrap-up/JourneyTour";
import { JOURNEY_STOPS } from "@/lib/journey-stops";

export const metadata: Metadata = {
  title: "The journey",
  description: "A guided tour of the MMRC 26 website as it was: registration season, then competition day.",
};

/**
 * The journey: the site as it was, in two eras, as a guided tour of captures.
 * Static: the captures and the notes do not change.
 */
export default function JourneyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">MMRC 26 · The journey</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold text-ras-purple dark:text-white sm:text-5xl">Walk through the site as it was</h1>
      <p className="mt-3 max-w-2xl text-ras-gray dark:text-white/70">
        mmrchtu.tech looked different every few weeks. Here it is in two eras, page by page: press play and it walks you through, or
        step through it yourself. Every page in the frame scrolls.
      </p>
      <JourneyTour stops={JOURNEY_STOPS} />
    </div>
  );
}
