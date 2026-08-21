import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import {
  STATE_LABELS,
  buildTimeline,
  focusEvent,
  scheduleProgress,
  type ScheduleItem,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule",
  description: "Key dates for MMRC 26, from registration to the final run.",
};

export default async function SchedulePage() {
  const events = await prisma.scheduleEvent.findMany({ orderBy: { startsAt: "asc" } });
  const timeline = buildTimeline(events);
  const progress = scheduleProgress(timeline);
  const focus = focusEvent(timeline);
  const done = timeline.filter((item) => item.state === "past").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Schedule
      </h1>
      <p className="mt-3 text-ras-gray dark:text-white/70">
        Every key date from registration to the final run.
      </p>

      {timeline.length > 0 ? (
        <>
          {/*
            The state of the season in one line. The list below says what is
            happening; this says how far through it we are — which the reader
            was previously left to work out by comparing every date against
            today's.
          */}
          <div className="mt-8 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
                {focus ? focus.title : "That is the lot"}
              </p>
              <p className="text-sm font-medium text-ras-crimson dark:text-mood-rose">
                {focus ? focus.when : "Every date has passed"}
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${done} of ${timeline.length} events complete`}
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ras-gray/20"
            >
              <div
                className="h-full rounded-full bg-ras-purple transition-[width] duration-500 motion-reduce:transition-none dark:bg-white"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
              {done} of {timeline.length} done
            </p>
          </div>

          <ol className="stagger relative mt-10">
            {timeline.map((item, index) => (
              <TimelineRow key={item.id} item={item} last={index === timeline.length - 1} />
            ))}
          </ol>
        </>
      ) : (
        <div className="mt-10 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-6 text-center">
          <p className="text-lg font-medium text-ras-purple dark:text-white">Nothing scheduled yet</p>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/60">
            Dates are announced here as soon as they are fixed.
          </p>
        </div>
      )}
    </div>
  );
}

/** Per-state colours for the rail, the marker and the badge. */
const TONE: Record<ScheduleItem["state"], { dot: string; badge: string; rail: string }> = {
  past: {
    dot: "border-ras-gray/40 bg-ras-gray/30",
    badge: "bg-ras-gray/10 text-ras-gray dark:bg-white/10 dark:text-white/60",
    rail: "bg-ras-gray/25",
  },
  now: {
    dot: "border-ras-crimson bg-ras-crimson",
    badge: "bg-ras-crimson text-white",
    rail: "bg-ras-crimson/40",
  },
  today: {
    dot: "border-ras-crimson bg-ras-crimson/70",
    badge: "bg-ras-crimson/15 text-ras-crimson dark:bg-rose-400/20 dark:text-rose-300",
    rail: "bg-ras-crimson/30",
  },
  next: {
    dot: "border-ras-purple bg-[var(--color-surface)]",
    badge: "bg-ras-purple text-white",
    rail: "bg-ras-purple/30",
  },
  upcoming: {
    dot: "border-ras-purple/40 bg-[var(--color-surface)]",
    badge: "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white/70",
    rail: "bg-ras-purple/20",
  },
};

function TimelineRow({ item, last }: { item: ScheduleItem; last: boolean }) {
  const tone = TONE[item.state];
  const isPast = item.state === "past";
  const live = item.state === "now";

  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {/* Drawn per row rather than as one absolute line down the whole list, so
          each segment takes the colour of the event above it and the rail stops
          cleanly at the final marker instead of trailing into nothing. */}
      {!last ? (
        <span aria-hidden="true" className={`absolute left-[7px] top-5 h-full w-0.5 ${tone.rail}`} />
      ) : null}

      <span
        aria-hidden="true"
        className={`relative z-10 mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 ${tone.dot}`}
      >
        {/* Only the live event pulses. If they all did it would be wallpaper. */}
        {live ? (
          <span className="marker-pulse absolute -inset-1 rounded-full border-2 border-ras-crimson" />
        ) : null}
      </span>

      <div className={`min-w-0 flex-1 ${isPast ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">{item.title}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone.badge}`}>
            {STATE_LABELS[item.state]}
          </span>
        </div>

        <p className="mt-1 text-sm text-ras-gray dark:text-white/70">{item.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ras-gray dark:text-white/60">
          <Badge>
            <time dateTime={item.startsAt.toISOString()}>
              {item.startsAt.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          </Badge>
          <span className="font-medium text-ras-crimson dark:text-mood-rose">{item.when}</span>
          {item.location ? <span>{item.location}</span> : null}
        </div>

        {/* Adding a date that has already passed to a calendar helps nobody. */}
        {!isPast ? (
          <a
            href={`/api/schedule/${item.id}/ics`}
            download
            className="-mx-2 mt-1 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-crimson transition-colors hover:underline dark:text-mood-rose"
          >
            Add to calendar
          </a>
        ) : null}
      </div>
    </li>
  );
}
