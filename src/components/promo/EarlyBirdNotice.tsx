/**
 * The date the discount closes, as the admin who set it would recognise it.
 *
 * The locale is pinned but the time zone deliberately is not. The cutoff is
 * written from a datetime-local field parsed with a bare `new Date(...)`, which
 * reads it in the server's own zone (see updatePaymentConfig, and the matching
 * toLocalInputValue that renders it back into that field). Formatting it here
 * in that same zone is what makes the two round-trip: pin a zone on the way out
 * only, and an admin who typed the 12th is told the site says the 13th.
 *
 * Pinning the locale is a different matter and worth doing — it stops the month
 * name depending on how the host happens to be configured.
 */
const CUTOFF_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Explains the discount at the top of the register page.
 *
 * Takes the terms as props rather than reading them, so the page renders one
 * set of facts: the banner above it and this notice cannot disagree about
 * whether the offer is running.
 *
 * The claim that the price is locked in is not a flourish — createRegistration
 * computes the fee once and freezes it into the row, and nothing recomputes it
 * on read, so a team that registers today keeps this price after the cutoff.
 */
export function EarlyBirdNotice({ percent, cutoff }: { percent: number; cutoff: Date }) {
  return (
    <div
      role="status"
      className="rounded-md border border-ras-crimson/30 bg-ras-crimson/5 p-5 text-sm text-ras-gray dark:border-white/15 dark:bg-white/5 dark:text-white/70"
    >
      <p className="font-display text-base font-bold text-accent">
        Early bird &mdash; {percent}% off
      </p>
      <p className="mt-2">
        Register before <strong className="font-semibold">{CUTOFF_FORMAT.format(cutoff)}</strong>{" "}
        and your team&rsquo;s entry fee is reduced by {percent}%, whichever membership tier you
        qualify for.
      </p>
      <p className="mt-2">
        There is no code to enter. The discount is worked out for you and shown on the payment
        step, before you pay anything.
      </p>
      <p className="mt-2">
        Your price is fixed at the moment you register, so it stays discounted even after the
        deadline passes.
      </p>
    </div>
  );
}
