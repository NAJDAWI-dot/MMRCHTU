import Link from "next/link";
import { Countdown } from "@/components/brand/Countdown";
import { DayAutoRefresh } from "@/components/day/DayAutoRefresh";
import { LiveDot } from "@/components/day/LiveDot";
import { toParagraphs } from "@/lib/competition-day";
import { shouldShowCountdown } from "@/lib/countdown";
import { clockTime, postedAgo } from "@/lib/day-mode";
import type { DaySiteData } from "@/lib/day-site";
import { STATE_LABELS, type ScheduleItem } from "@/lib/schedule";

/**
 * The competition day site: what mmrchtu.tech/ shows while day mode is on.
 *
 * Written for a phone held in a hall rather than a laptop at home, so the order
 * is the order of questions people ask on the day: what is on now, what is
 * next, has anything changed, when is everything else, who is here. The
 * details a visitor needed beforehand (how to register, the rulebook) are the
 * pages day mode takes down.
 */
export function DayHome({ data, preview = false }: { data: DaySiteData; preview?: boolean }) {
  const paragraphs = toParagraphs(data.details);
  const countdown = shouldShowCountdown(data.eventDate) && data.eventDate;
  const links = [
    { href: "/schedule", label: "Full schedule" },
    { href: "/faq", label: "FAQ" },
    { href: "/micromouse", label: "How a micromouse works" },
    { href: "/game", label: "Play Pac Mouse" },
    { href: "/gallery", label: "Photos" },
  ].filter((link) => !data.hidden.has(link.href));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:pt-10">
      {preview ? null : <DayAutoRefresh />}

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a0e2f] via-[#4a1752] to-[#6d0a2c] px-5 py-8 text-white shadow-[0_20px_60px_-25px_rgba(95,33,103,0.8)] sm:px-10 sm:py-12">
        {/* The maze floor, faint, behind everything: a grid of 18cm cells is
            what the whole day is about. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:44px_44px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#F2A900]/20 blur-3xl"
        />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em]">
            <LiveDot />
            Live · Competition day
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            {data.headline}
          </h1>
          {data.intro ? <p className="mt-3 max-w-2xl text-white/75 sm:text-lg">{data.intro}</p> : null}

          {data.dateText || data.venue ? (
            <dl className="mt-6 flex flex-wrap gap-3">
              {data.dateText ? <HeroFact label="Date" value={data.dateText} /> : null}
              {data.venue ? <HeroFact label="Venue" value={data.venue} /> : null}
            </dl>
          ) : null}

          {countdown ? (
            <div className="mt-8">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-white/60">
                First run in
              </p>
              <Countdown target={countdown} />
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ now and next */}
      <section aria-label="Now and next" className="mt-6 grid gap-4 md:grid-cols-2">
        <NowCard item={data.focus} scheduled={data.timeline.length > 0} />
        <NextCard item={data.after} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ----------------------------------------------------- announcements */}
        <section aria-labelledby="day-announcements">
          <SectionHeading id="day-announcements" kicker="From the desk">
            Announcements
          </SectionHeading>
          {data.announcements.length ? (
            <ul className="mt-4 space-y-3">
              {data.announcements.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 ${
                    item.isPinned
                      ? // A solid surface with the gold laid over it, never the
                        // gold alone: a translucent card lets the site artwork
                        // show through the words.
                        "border-[#F2A900]/60 bg-[var(--color-surface)] bg-gradient-to-br from-[#F2A900]/20 to-[#F2A900]/5"
                      : "border-ras-gray/20 bg-[var(--color-surface)] dark:border-white/10"
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed text-[var(--color-fg)]">{item.body}</p>
                  <p className="mt-2 text-xs text-ras-gray dark:text-white/55">
                    {item.isPinned ? (
                      <span className="mr-2 font-semibold uppercase tracking-wide text-[#8a5f00] dark:text-[#F2A900]">
                        Pinned
                      </span>
                    ) : null}
                    {postedAgo(item.createdAt, data.now)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-ras-gray/30 p-4 text-sm text-ras-gray dark:border-white/15 dark:text-white/60">
              Nothing yet. Anything the desk needs you to know appears here, and this page keeps
              itself up to date.
            </p>
          )}
        </section>

        {/* ----------------------------------------------------- running order */}
        <section aria-labelledby="day-running-order">
          <SectionHeading id="day-running-order" kicker="Times are Amman time">
            Running order
          </SectionHeading>
          {data.timeline.length ? (
            <ol className="relative mt-4 border-l-2 border-ras-purple/20 pl-5 dark:border-white/15">
              {data.timeline.map((item) => (
                <TimelineRow key={item.id} item={item} />
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-ras-gray dark:text-white/60">
              The running order goes up here once it is set.
            </p>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------------- teams */}
      {data.teams.length ? (
        <section aria-labelledby="day-teams" className="mt-12">
          <SectionHeading id="day-teams" kicker={`${data.teams.length} on the start line`}>
            Teams
          </SectionHeading>
          <ul className="mt-4 flex flex-wrap gap-2">
            {data.teams.map((team) => (
              <li
                key={team.id}
                className="rounded-full border border-ras-purple/25 bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-semibold text-ras-purple dark:border-white/15 dark:text-white"
              >
                {team.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------ good to know */}
      {paragraphs.length ? (
        <section aria-labelledby="day-details" className="mt-12">
          <SectionHeading id="day-details" kicker="Before you ask">
            Good to know
          </SectionHeading>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="whitespace-pre-line rounded-xl border border-ras-gray/15 bg-[var(--color-surface)] p-4 leading-relaxed text-ras-gray dark:border-white/10 dark:text-white/80"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {links.length ? (
        <nav aria-label="More on the site" className="mt-12 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-ras-gray/25 px-4 py-2 text-sm font-medium text-ras-gray transition-colors hover:border-ras-purple/50 hover:text-ras-purple dark:border-white/15 dark:text-white/75 dark:hover:border-white/40 dark:hover:text-white"
            >
              {link.label} →
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function SectionHeading({
  id,
  kicker,
  children,
}: {
  id: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{kicker}</p>
      <h2 id={id} className="mt-1 font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        {children}
      </h2>
    </div>
  );
}

function timeRange(item: ScheduleItem): string {
  return item.endsAt ? `${clockTime(item.startsAt)} to ${clockTime(item.endsAt)}` : clockTime(item.startsAt);
}

function NowCard({ item, scheduled }: { item: ScheduleItem | null; scheduled: boolean }) {
  const live = item?.state === "now";
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 ${
        live
          ? "border-ras-crimson/40 bg-[var(--color-surface)] bg-gradient-to-br from-ras-crimson/10 to-transparent dark:border-mood-rose/50 dark:from-mood-rose/15"
          : "border-ras-gray/20 bg-[var(--color-surface)] dark:border-white/10"
      }`}
    >
      <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        {live ? <LiveDot /> : null}
        {item ? STATE_LABELS[item.state] : "Now"}
      </p>
      {item ? (
        <>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ras-purple dark:text-white sm:text-3xl">
            {item.title}
          </h2>
          <p className="mt-1 font-mono text-sm text-ras-gray dark:text-white/70">
            {timeRange(item)}
            {item.location ? ` · ${item.location}` : ""}
          </p>
          {item.description ? (
            <p className="mt-3 text-sm leading-relaxed text-ras-gray dark:text-white/70">{item.description}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-ras-gray dark:text-white/70">
          {scheduled
            ? "That is everything for today. Thank you for coming."
            : "The running order goes up here once it is set."}
        </p>
      )}
    </div>
  );
}

function NextCard({ item }: { item: ScheduleItem | null }) {
  return (
    <div className="rounded-2xl border border-ras-gray/20 bg-[var(--color-surface)] p-5 dark:border-white/10 sm:p-6">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ras-gray dark:text-white/60">
        After that
      </p>
      {item ? (
        <>
          <h2 className="mt-2 font-display text-xl font-bold text-ras-purple dark:text-white sm:text-2xl">
            {item.title}
          </h2>
          <p className="mt-1 font-mono text-sm text-ras-gray dark:text-white/70">
            {timeRange(item)}
            {item.location ? ` · ${item.location}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-ras-gray dark:text-white/70">Nothing else scheduled after this.</p>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: ScheduleItem }) {
  const past = item.state === "past";
  const live = item.state === "now";
  return (
    <li className={`relative pb-5 last:pb-0 ${past ? "opacity-55" : ""}`}>
      <span
        aria-hidden="true"
        className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${
          live
            ? "border-ras-crimson bg-ras-crimson dark:border-mood-rose dark:bg-mood-rose"
            : past
              ? "border-ras-gray/40 bg-ras-gray/40"
              : "border-ras-purple bg-[var(--color-bg)] dark:border-white/70"
        }`}
      />
      <p className="font-mono text-xs text-ras-gray dark:text-white/60">
        {timeRange(item)}
        {live ? (
          <span className="ml-2 font-semibold uppercase tracking-wide text-accent">Now</span>
        ) : past ? (
          <span className="ml-2 uppercase tracking-wide">Done</span>
        ) : null}
      </p>
      <p className="mt-0.5 font-semibold text-ras-purple dark:text-white">{item.title}</p>
      {item.location ? <p className="text-sm text-ras-gray dark:text-white/60">{item.location}</p> : null}
    </li>
  );
}
