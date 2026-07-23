import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCounter } from "@/components/ui/StatCounter";

export default function HomePage() {
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
          and play Cheddar Mouse — our maze game — while you wait for results.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild>
            <Link href="/register">Register your team</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/game">Play Cheddar Mouse</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatCounter statKey="registrations" label="Teams registered" />
        <StatCounter statKey="submissions" label="Submissions" />
        <StatCounter statKey="game_plays" label="Cheddar Mouse plays" />
        <StatCounter statKey="participants" label="Participants" />
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
