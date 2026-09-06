import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/brand/Countdown";
import { FeatureCard } from "@/components/home/FeatureCard";
import { EarlyBirdBadge } from "@/components/promo/EarlyBirdBadge";
import { parseStatus } from "@/lib/competition-day";

import { shouldShowCountdown } from "@/lib/countdown";
import { hiddenPageHrefs } from "@/lib/page-visibility";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { getEarlyBirdState } from "@/lib/early-bird-server";

// The countdown reads a live config row, so this page cannot be baked at
// build time and still be right.
// The only database-backed thing here is the competition date, and the
// clock itself ticks in the browser. Admin saves call revalidatePath("/",
// "layout"), so a changed date appears at once rather than in five minutes.
export const revalidate = 300;

/**
 * The three cards under the hero.
 *
 * Data rather than markup so they can be filtered against the pages an admin
 * has switched off. They used to be written out one by one, which meant the
 * site menu dropped a hidden page while the homepage went on advertising it —
 * a card leading straight to "not found", which is the exact outcome the Pages
 * tab exists to prevent.
 */
const FEATURE_CARDS = [
  {
    href: "/rules",
    title: "Rules & scoring",
    blurb: "Read the full MMRC 26 rulebook before you build.",
    cta: "View rules",
    // Decorative only: the corner wall's colour and the lift's glow. The link
    // text keeps the accent token, which is the one that has to clear a
    // contrast threshold. Three different hues from the moodboard rather than
    // one repeated, so the row reads as three things and not one stamped out
    // three times.
    accent: "#5f2167",
  },
  {
    href: "/schedule",
    title: "Schedule",
    blurb: "Key dates from registration to the final run.",
    cta: "View schedule",
    accent: "#97012d",
  },
  {
    href: "/faq",
    title: "FAQ",
    blurb: "Answers to common questions from past competitors.",
    cta: "View FAQ",
    accent: "#732e7d",
  },
  {
    href: "/team",
    title: "The committee",
    blurb: "The students who write the rules, run the desk and judge the runs.",
    cta: "Meet the team",
    // The moodboard's gold, and the only card not in the purple-to-crimson
    // range — this is the one card about people rather than about the
    // competition, and it should not read as a fourth of the same thing.
    accent: "#f2a900",
  },
] as const;

export default async function HomePage() {
  const [config, hidden, earlyBird] = await Promise.all([
    getCompetitionDayConfig(),
    hiddenPageHrefs(),
    getEarlyBirdState(),
  ]);

  /*
    Whether the Competition Day *page* is reachable. It gates the link below,
    not the clock.

    The clock used to be gated on it too, so a page still marked HIDDEN while
    its running order was being written left the homepage saying nothing at all
    about when the competition was. The date is the single most useful fact
    here, and it is not a secret — only the details behind it are.

    Two reasons it can be unreachable, and both have to be checked: its own
    status, and an admin switching it off on the Pages tab.
  */
  const dayPageVisible =
    parseStatus(config.status) !== "HIDDEN" && !hidden.has("/competition-day");
  const showCountdown = shouldShowCountdown(config.eventDate);
  const cards = FEATURE_CARDS.filter((card) => !hidden.has(card.href));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">

      <section className="text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-accent">
          IEEE RAS HTU Student Chapter presents
        </p>
        <h1 className="mt-3 font-display text-5xl font-extrabold text-ras-purple dark:text-white">
          MMRC 26
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ras-gray dark:text-white/70">
          The 2026 Micro Mouse Robot Competition. Build a maze-solving robot, race the clock,
          and play Pac Mouse — our maze game — while you wait for results.
        </p>
        {/* The two calls to action go with their pages. Registration closing is
            a different thing entirely — that leaves the page up and explains
            itself, so it is not checked here. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {!hidden.has("/register") ? (
            // The wrapper is what the badge hangs from. It cannot go on the
            // Button itself: that renders as its child here, so the class would
            // land on the <Link> and the pill would be positioned against the
            // text rather than the button around it.
            <span className="relative inline-block">
              <Button asChild size="lg">
                <Link href="/register">Register your team</Link>
              </Button>
              {earlyBird.active ? <EarlyBirdBadge /> : null}
            </span>
          ) : null}
          {!hidden.has("/game") ? (
            <Button variant="ghost" asChild size="lg">
              <Link href="/game">Play Pac Mouse</Link>
            </Button>
          ) : null}
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
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
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
                  className="-mx-2 mt-1 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-accent hover:underline"
                >
                  Competition day details →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {/*
        Nothing at all rather than an empty row, on the off chance an admin
        hides every one of them.

        Two up on a tablet, four across on a wide screen: three columns with
        four cards left the last one stranded on a row of its own.
      */}
      {cards.length > 0 ? (
        <section className="stagger mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => (
            <FeatureCard key={card.href} card={card} accent={card.accent} seed={i + 1} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
