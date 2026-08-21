import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/brand/Countdown";
import { parseStatus, toParagraphs } from "@/lib/competition-day";
import { shouldShowCountdown } from "@/lib/countdown";
import { buildTimeline, focusEvent } from "@/lib/schedule";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";
import { JsonLd } from "@/components/seo/JsonLd";
import { eventJsonLd } from "@/lib/structured-data";

// Carries a relative time for the next event, so it ages like the schedule
// does. Admin saves revalidate it immediately regardless.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Competition Day",
  description: "Date, venue, and running order for MMRC 26 competition day.",
};

export default async function CompetitionDayPage() {
  const [config, events] = await Promise.all([
    getCompetitionDayConfig(),
    prisma.scheduleEvent.findMany({ orderBy: { startsAt: "asc" } }),
  ]);

  const status = parseStatus(config.status);
  if (status === "HIDDEN") notFound();

  const published = status === "PUBLISHED";
  const paragraphs = toParagraphs(config.details);
  // Shown while the page is still COMING_SOON too: a clock ticking down is the
  // most useful thing a holding page can offer, and it needs no details to be
  // decided first.
  const countdown = shouldShowCountdown(config.eventDate);
  const nextUp = focusEvent(buildTimeline(events));

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* Described here rather than in the layout because this is the page that
          holds the date and the venue — the two facts that make an Event entry
          worth emitting at all. */}
      <JsonLd
        data={eventJsonLd({
          name: config.headline,
          description: config.intro || metadata.description || "",
          startDate: config.eventDate,
          venue: config.venue,
        })}
      />
      {/*
        The hero carries the two facts everyone comes for — when and where —
        against something with depth, rather than opening on a heading and a
        paragraph of grey text.
      */}
      <section className="relative overflow-hidden rounded-2xl border border-ras-purple/25 bg-gradient-to-br from-ras-purple/12 via-transparent to-ras-crimson/12 px-5 py-10 text-center sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-ras-purple/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-ras-crimson/15 blur-3xl"
        />

        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ras-crimson dark:text-mood-rose">
            {published ? "Competition day" : "Coming soon"}
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-ras-purple dark:text-white sm:text-5xl">
            {config.headline}
          </h1>
          {config.intro ? (
            <p className="mx-auto mt-4 max-w-2xl text-ras-gray dark:text-white/70">{config.intro}</p>
          ) : null}

          {countdown && config.eventDate ? (
            <div className="mt-8 flex justify-center">
              <Countdown target={config.eventDate} />
            </div>
          ) : null}

          {config.dateText || config.venue ? (
            <div className="mt-8 flex flex-wrap items-stretch justify-center gap-3">
              {config.dateText ? <Fact label="Date" value={config.dateText} /> : null}
              {config.venue ? <Fact label="Venue" value={config.venue} /> : null}
            </div>
          ) : null}
        </div>
      </section>

      {published ? (
        <>
          {paragraphs.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-display text-xl font-bold text-ras-purple dark:text-white">
                On the day
              </h2>
              <div className="stagger mt-4 space-y-4">
                {paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="whitespace-pre-line rounded-lg border border-ras-gray/15 bg-[var(--color-surface)] p-4 leading-relaxed text-ras-gray dark:text-white/80"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ) : (
            // Published with nothing written yet — fall back to the holding
            // message rather than showing an empty page.
            <HoldingNote text={config.comingSoonText} />
          )}
        </>
      ) : (
        <HoldingNote text={config.comingSoonText} />
      )}

      {/*
        The page used to dead-end. Whatever state it is in, the schedule is the
        useful next click, and naming the next date makes it worth taking.
      */}
      <section className="mt-12 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-ras-purple dark:text-white">
              {nextUp ? nextUp.title : "The full schedule"}
            </h2>
            <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
              {nextUp ? `Next up — ${nextUp.when}.` : "Every key date in one place."}
            </p>
          </div>
          <Link
            href="/schedule"
            className="-mx-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson transition-colors hover:underline dark:text-mood-rose"
          >
            See the schedule →
          </Link>
        </div>
      </section>
    </div>
  );
}

/** One headline fact — the date or the venue — given room to be read. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[9rem] rounded-lg border border-ras-purple/20 bg-[var(--color-surface)]/80 px-5 py-3 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-widest text-ras-gray dark:text-white/60">
        {label}
      </p>
      <p className="mt-0.5 font-display font-bold text-ras-purple dark:text-white">{value}</p>
    </div>
  );
}

function HoldingNote({ text }: { text: string }) {
  return (
    <section className="mt-12 rounded-lg border border-dashed border-ras-purple/30 bg-[var(--color-surface)] p-8 text-center">
      <p className="text-lg font-medium text-ras-purple dark:text-white">{text}</p>
      <p className="mt-3 text-sm text-ras-gray dark:text-white/60">
        Everything already announced is on the{" "}
        <Link href="/schedule" className="font-semibold text-ras-crimson hover:underline dark:text-mood-rose">
          schedule
        </Link>
        .
      </p>
    </section>
  );
}
