import type { Metadata } from "next";
import Link from "next/link";
import { GameTabs } from "@/game/classic/GameTabs";
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
      select: {
        id: true,
        teamName: true,
        // The leader's university, which is the one every entry has.
        members: { select: { university: true }, orderBy: { order: "asc" }, take: 1 },
      },
    }),
    prisma.registration.count({ where: { status: { not: "CANCELLED" } } }),
  ]);

  const teams: WallTeam[] = rows.map((row) => ({
    id: row.id,
    name: row.teamName,
    university: row.members[0]?.university ?? "",
  }));

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
