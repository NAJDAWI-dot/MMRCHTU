import Link from "next/link";
import { Countdown, type CountdownSize } from "@/components/brand/Countdown";
import { EarlyBirdCountdown } from "@/components/promo/EarlyBirdCountdown";
import type { EarlyBirdState } from "@/lib/early-bird";

/**
 * The lit panel that holds the competition-day clock.
 *
 * Lifted out of the homepage when the register page needed the same object.
 * Two copies of that gradient, both glows and the stacking-context note would
 * have drifted apart within a release, and the panel is the one place on the
 * site where the brand's full purple-to-rose ramp is on show — it is worth
 * having exactly one of.
 *
 * Everything it can hold below the clock is optional, because the two callers
 * want different things under it: the homepage carries the date, the venue and
 * a way through to the details, while the register page wants none of that
 * competing with the form it is sitting above.
 */
interface CountdownPanelProps {
  /** When the competition starts. */
  target: Date;
  /** How large to draw the competition-day clock. */
  size?: CountdownSize;
  /** Date and venue, already joined. Omitted when there is nothing to say. */
  meta?: string;
  /** Where "Competition day details" should go, or null for no link at all. */
  detailsHref?: string | null;
  /** The discount, which adds a second, smaller clock beneath the first. */
  earlyBird: EarlyBirdState;
}

export function CountdownPanel({
  target,
  size = "lg",
  meta,
  detailsHref = null,
  earlyBird,
}: CountdownPanelProps) {
  return (
    /* `isolate` is what keeps the two glows behind the text: it makes this the
       stacking context, so the -z-10 below lands above the panel's own gradient
       but under everything written on top of it. Without it the glows paint
       over the digits, which at these opacities is visible. */
    <div className="relative isolate mx-auto max-w-2xl overflow-hidden rounded-2xl border border-ras-purple/40 bg-gradient-to-br from-mood-orchid/25 via-ras-purple/10 to-mood-rose/25 px-5 py-7 shadow-lg shadow-ras-purple/10 sm:px-8 dark:border-mood-violet/45 dark:from-mood-violet/30 dark:via-transparent dark:to-mood-rose/30 dark:shadow-none">
      {/* Two sweeps rather than one, from opposite corners: the panel reads as
          lit from both ends of the digits' gradient instead of fading off to
          nothing on the left. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-mood-rose/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 -z-10 h-52 w-52 rounded-full bg-mood-orchid/25 blur-3xl"
      />
      <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Competition day in
      </p>
      <div className="mt-4 flex justify-center">
        <Countdown target={target} size={size} />
      </div>
      {meta ? (
        <p className="mt-5 text-center text-sm text-ras-gray dark:text-white/70">{meta}</p>
      ) : null}
      {detailsHref ? (
        <p className="text-center">
          <Link
            href={detailsHref}
            className="-mx-2 mt-1 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-accent hover:underline"
          >
            Competition day details →
          </Link>
        </p>
      ) : null}
      {/*
        The discount goes last rather than directly under the digits. The date,
        the venue and the link all belong to the clock above them, and dropping
        a second deadline into the middle of that group splits one thought in
        half. At the foot of the panel, under its own rule, it reads as what it
        is: a second, smaller deadline in the same box.
      */}
      {earlyBird.active ? (
        <EarlyBirdCountdown percent={earlyBird.percent} cutoff={earlyBird.cutoff} />
      ) : null}
    </div>
  );
}
