import type { Metadata } from "next";
import Link from "next/link";
import { GameTabs } from "@/game/classic/GameTabs";
import { MouseMark } from "@/components/brand/MouseMark";
import { MazeExplainer } from "@/components/open-day/MazeExplainer";
import { CrestStudio } from "@/components/open-day/CrestStudio";
import { TeamWall, type WallTeam } from "@/components/open-day/TeamWall";
import { OPEN_DAY_EVENT } from "@/lib/leaderboard";
import { WALL_LIMIT } from "@/lib/open-day";
import { normaliseReferralCode } from "@/lib/referral";
import { prisma } from "@/lib/prisma";

/**
 * The page behind the QR code on the stand.
 *
 * Written for one situation and no other: somebody scans a code at the IEEE
 * RAS HTU stand, on their own phone, in a hall loud enough that sound is
 * useless, and gives it about thirty seconds. So there is no prospectus here.
 * There are four things to do, each of which answers a question a passer-by
 * actually has, in the order they have them: what is this, what do I get out
 * of standing here, who else is doing it, and can I have a go.
 *
 * Registration sits under all of it rather than on top. Almost nobody forms a
 * team while standing at a stand, and a long form as the first thing on the
 * page wastes the one visit.
 */

export const metadata: Metadata = {
  title: "Open Day",
  description:
    "IEEE RAS HTU at the university open day: what a micromouse is, your own team crest, the teams already entered, and Pac Mouse with a live board.",
};

// The wall and the board are both counts that change while the day is running,
// and a cached page at a stand is a page showing this morning.
export const dynamic = "force-dynamic";

export default async function OpenDayPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  // Carried through every link out of this page, so a visitor who scanned one
  // ambassador's code still counts for them after a detour through the crest.
  const referral = normaliseReferralCode(searchParams.ref ?? "").slice(0, 20);

  const [rows, total] = await Promise.all([
    prisma.registration.findMany({
      // A cancelled entry is not a team that is coming, and its name on the
      // wall would be a promise the day cannot keep.
      where: { status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: WALL_LIMIT,
      // Names only. Nothing else about a team belongs on a screen in a hall.
      select: { id: true, teamName: true },
    }),
    prisma.registration.count({ where: { status: { not: "CANCELLED" } } }),
  ]);

  const teams: WallTeam[] = rows.map((row) => ({ id: row.id, name: row.teamName }));

  const registerHref = referral ? `/register?ref=${encodeURIComponent(referral)}` : "/register";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ras-crimson dark:text-[#ff9b9b]">
          IEEE RAS HTU
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-ras-purple dark:text-white sm:text-5xl">
          Welcome to the stand
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ras-gray dark:text-white/75">
          We are the Robotics and Automation Society chapter at HTU, and we run MMRC26: a
          competition where robots built by students solve a maze on their own. Four things to do
          here, none of which takes longer than a minute.
        </p>

        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
          {[
            { href: "#what", label: "What is this" },
            { href: "#crest", label: "Get your crest" },
            { href: "#wall", label: "Who is entered" },
            { href: "#play", label: "Play Pac Mouse" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-[44px] items-center rounded-full border border-ras-purple/30 px-4 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/25 dark:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <section id="what" className="mt-12 scroll-mt-24">
        <SectionHeading
          number="1"
          title="What a micromouse is"
          blurb="Watch it once. It explains itself."
        />
        <div className="mt-5">
          <MazeExplainer />
        </div>
      </section>

      <section id="crest" className="mt-14 scroll-mt-24">
        <SectionHeading
          number="2"
          title="Get your crest"
          blurb="Every team in MMRC26 gets a maze of its own, built from its name. Take yours now, whether or not you enter."
        />
        <div className="mt-5 rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6">
          <CrestStudio referral={referral} />
        </div>
      </section>

      <section id="wall" className="mt-14 scroll-mt-24">
        <SectionHeading
          number="3"
          title="The teams already in"
          blurb="One maze each, drawn from the name they registered under."
        />
        <div className="mt-5">
          <TeamWall teams={teams} total={total} />
        </div>
      </section>

      <section id="play" className="mt-14 scroll-mt-24">
        <SectionHeading
          number="4"
          title="Play Pac Mouse"
          blurb="Today's scores only, so you are playing against the people standing here, not against everyone who has ever opened the site. Highest score at the stand wins."
        />
        <div className="mt-5">
          <GameTabs event={OPEN_DAY_EVENT} live boardLabel="open day" />
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-ras-purple/25 bg-ras-purple/5 p-6 text-center dark:border-white/15 dark:bg-white/5">
        <h2 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
          Want to build one?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ras-gray dark:text-white/75">
          Teams are one to three people. You do not need to have built a robot before, and you do
          not need to decide today. Read the rules first if you like.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={registerHref}
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
          {/*
            The committee, marked out the way the menu marks it out: the brand
            gradient, a mouse, and a lift on hover. Everything else on this page
            is about a competition, and the question people actually ask at a
            stand is who is running it. It should not look like a third footnote
            beside two buttons about paperwork.

            The solid surface under the gradient is not decoration. The menu's
            pill sits on a near-white header; this one sits on a panel already
            tinted with the same purple, and a translucent purple over a purple
            wash came out muddy enough to read as the weakest of the three.
          */}
          <Link
            href="/team"
            className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ras-purple/30 bg-[var(--color-surface)] bg-gradient-to-r from-ras-purple/15 via-ras-crimson/10 to-ras-purple/15 px-6 text-sm font-bold text-ras-purple shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-ras-purple/55 hover:shadow-md active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/25 dark:from-white/12 dark:via-white/5 dark:to-white/12 dark:text-white dark:hover:border-white/45"
          >
            <MouseMark className="h-4 w-4 opacity-80 transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
            Meet the committee
          </Link>
        </div>
        {referral ? (
          <p className="mt-4 text-xs text-ras-gray dark:text-white/55">
            You came in on code <span className="font-mono font-bold">{referral}</span>. It is
            filled in for you when you register.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  blurb,
}: {
  number: string;
  title: string;
  blurb: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ras-purple font-display text-sm font-bold text-white"
      >
        {number}
      </span>
      <div>
        <h2 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ras-gray dark:text-white/70">
          {blurb}
        </p>
      </div>
    </div>
  );
}
