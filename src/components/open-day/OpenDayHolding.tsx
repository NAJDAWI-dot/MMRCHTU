import Link from "next/link";
import { MouseMark } from "@/components/brand/MouseMark";
import { OpenDayCountdown } from "@/components/open-day/OpenDayCountdown";

/**
 * What the open day page is before the open day.
 *
 * Everything on the real page is something you do while standing at a stand:
 * take a crest away, look at who has entered, play the board for the day. None
 * of it means anything a fortnight early, and a page full of it is a promise
 * being made twice. So until the doors open there is one thing here, which is
 * how long until they do.
 *
 * A holding screen rather than a 404. The link is printed on a QR code that
 * will be stuck to a table, put in a story and passed around before the day,
 * and every one of those has to lead somewhere that explains itself. A page
 * that says "not found" to somebody holding a poster is the worst of both.
 */
export function OpenDayHolding({
  startsAt,
  endsAt,
  location,
  mapUrl,
}: {
  startsAt: string;
  endsAt: string;
  location: string;
  mapUrl: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ras-crimson dark:text-[#ff9b9b]">
        IEEE RAS HTU
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-ras-purple dark:text-white sm:text-5xl">
        The stand is not open yet
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-ras-gray dark:text-white/75">
        Come back when this reaches zero. Everything here opens with the doors: a maze of your
        own to take away, the teams already entered, and a Pac Mouse board for the day.
      </p>

      <OpenDayCountdown
        startsAt={startsAt}
        endsAt={endsAt}
        location={location}
        mapUrl={mapUrl}
      />

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/register"
          className="inline-flex min-h-[44px] items-center rounded-full bg-ras-crimson px-6 text-sm font-bold text-white transition-transform active:scale-95"
        >
          Register a team
        </Link>
        <Link
          href="/rules"
          className="inline-flex min-h-[44px] items-center rounded-full border border-ras-purple/40 px-6 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/30 dark:text-white"
        >
          Read the rules
        </Link>
        <Link
          href="/team"
          className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ras-purple/30 bg-[var(--color-surface)] bg-gradient-to-r from-ras-purple/15 via-ras-crimson/10 to-ras-purple/15 px-6 text-sm font-bold text-ras-purple shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-ras-purple/55 hover:shadow-md active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/25 dark:from-white/12 dark:via-white/5 dark:to-white/12 dark:text-white dark:hover:border-white/45"
        >
          <MouseMark className="h-4 w-4 opacity-80 transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
          Meet the committee
        </Link>
      </div>
    </div>
  );
}
