import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/brand/Countdown";
import { parseStatus } from "@/lib/competition-day";
import { shouldShowCountdown } from "@/lib/countdown";
import { getCompetitionDayConfig } from "@/lib/site-config";

// The countdown reads a live config row, so this page cannot be baked at
// build time and still be right.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = await getCompetitionDayConfig();
  // Nothing is teased here that the Competition Day page itself is hiding.
  const visible = parseStatus(config.status) !== "HIDDEN";
  const showCountdown = visible && shouldShowCountdown(config.eventDate);

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
          <div className="mt-12 flex flex-col items-center">
            <p className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
              Competition day in
            </p>
            <div className="mt-3">
              <Countdown target={config.eventDate} compact />
            </div>
            <Link
              href="/competition-day"
              className="mt-3 text-sm font-semibold text-ras-crimson hover:underline"
            >
              Competition day details →
            </Link>
          </div>
        ) : null}
      </section>

      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        <Card>
          <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
            Rules &amp; scoring
          </h2>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Read the full MMRC 26 rulebook before you build.
          </p>
          <Link href="/rules" className="mt-4 inline-block text-sm font-semibold text-ras-crimson">
            View rules →
          </Link>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
            Schedule
          </h2>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Key dates from registration to the final run.
          </p>
          <Link href="/schedule" className="mt-4 inline-block text-sm font-semibold text-ras-crimson">
            View schedule →
          </Link>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
            FAQ
          </h2>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Answers to common questions from past competitors.
          </p>
          <Link href="/faq" className="mt-4 inline-block text-sm font-semibold text-ras-crimson">
            View FAQ →
          </Link>
        </Card>
      </section>
    </div>
  );
}
