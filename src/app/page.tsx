import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/brand/Countdown";
import { parseStatus } from "@/lib/competition-day";
import { shouldShowCountdown } from "@/lib/countdown";
import { getCompetitionDayConfig } from "@/lib/site-config";

// The countdown reads a live config row, so this page cannot be baked at
// build time and still be right.
// The only database-backed thing here is the competition date, and the
// clock itself ticks in the browser. Admin saves call revalidatePath("/",
// "layout"), so a changed date appears at once rather than in five minutes.
export const revalidate = 300;

export default async function HomePage() {
  const config = await getCompetitionDayConfig();
  /*
    Whether the Competition Day *page* is reachable. It gates the link below,
    not the clock.

    The clock used to be gated on it too, so a page still marked HIDDEN while
    its running order was being written left the homepage saying nothing at all
    about when the competition was. The date is the single most useful fact
    here, and it is not a secret — only the details behind it are.
  */
  const dayPageVisible = parseStatus(config.status) !== "HIDDEN";
  const showCountdown = shouldShowCountdown(config.eventDate);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-ras-crimson dark:text-mood-rose">
          IEEE RAS HTU Student Chapter presents
        </p>
        <h1 className="mt-3 font-display text-5xl font-extrabold text-ras-purple dark:text-white">
          MMRC 26
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ras-gray dark:text-white/70">
          The 2026 Micro Mouse Robot Competition. Build a maze-solving robot, race the clock,
          and play Pac Mouse — our maze game — while you wait for results.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild>
            <Link href="/register">Register your team</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/game">Play Pac Mouse</Link>
          </Button>
        </div>

        {showCountdown && config.eventDate ? (
          <div className="mt-14">
            {/* `isolate` is what keeps the two glows behind the text: it makes
                this the stacking context, so the -z-10 below lands above the
                panel's own gradient but under everything written on top of it.
                Without it the glows paint over the digits, which at these
                opacities is visible. */}
            <div className="relative isolate mx-auto max-w-2xl overflow-hidden rounded-2xl border border-ras-purple/40 bg-gradient-to-br from-mood-orchid/25 via-ras-purple/10 to-mood-rose/25 px-5 py-7 shadow-lg shadow-ras-purple/10 sm:px-8 dark:border-mood-violet/45 dark:from-mood-violet/30 dark:via-transparent dark:to-mood-rose/30 dark:shadow-none">
              {/* Two sweeps rather than one, from opposite corners: the panel
                  reads as lit from both ends of the digits' gradient instead of
                  fading off to nothing on the left. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-mood-rose/25 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-20 -z-10 h-52 w-52 rounded-full bg-mood-orchid/25 blur-3xl"
              />
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ras-crimson dark:text-mood-rose">
                Competition day in
              </p>
              <div className="mt-4 flex justify-center">
                <Countdown target={config.eventDate} />
              </div>
              {config.dateText || config.venue ? (
                <p className="mt-5 text-sm text-ras-gray dark:text-white/70">
                  {[config.dateText, config.venue].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {dayPageVisible ? (
                <Link
                  href="/competition-day"
                  className="-mx-2 mt-1 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson hover:underline dark:text-mood-rose"
                >
                  Competition day details →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="stagger mt-20 grid gap-6 sm:grid-cols-3">
        <Card interactive>
          <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
            Rules &amp; scoring
          </h2>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Read the full MMRC 26 rulebook before you build.
          </p>
          <Link href="/rules" className="-mx-2 mt-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson hover:underline">
            View rules →
          </Link>
        </Card>
        <Card interactive>
          <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
            Schedule
          </h2>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Key dates from registration to the final run.
          </p>
          <Link href="/schedule" className="-mx-2 mt-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson hover:underline">
            View schedule →
          </Link>
        </Card>
        <Card interactive>
          <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
            FAQ
          </h2>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Answers to common questions from past competitors.
          </p>
          <Link href="/faq" className="-mx-2 mt-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson hover:underline">
            View FAQ →
          </Link>
        </Card>
      </section>
    </div>
  );
}
