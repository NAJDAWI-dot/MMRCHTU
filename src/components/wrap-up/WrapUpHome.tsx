import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FeatureCard } from "@/components/home/FeatureCard";
import { SponsorLogo } from "@/components/day-site/SponsorLogo";
import { CreditsScene } from "@/components/wrap-up/CreditsScene";
import { awardsList, picksOf, type Award } from "@/lib/awards";
import { CELL, pickMaze, seededRandom } from "@/lib/maze";
import { loadDayPhotos } from "@/lib/day-photos";
import { loadSlideSponsors } from "@/lib/day-sponsors";
import { hiddenPageHrefs } from "@/lib/page-visibility";
import { prisma } from "@/lib/prisma";
import { loadPublicCompetition } from "@/lib/public-competition";
import { getCompetitionDayConfig } from "@/lib/site-config";
import {
  BUILD_STARTED,
  BUILD_STATS,
  DEVELOPER_LINKEDIN,
  DEVELOPER_NAME,
  DEVELOPER_ROLE,
  messageParagraphs,
} from "@/lib/wrap-up";

/** What stays useful between competitions, for anyone building for the next one. */
const ALL_YEAR = [
  {
    href: "/micromouse",
    title: "Micro Mouse",
    blurb: "The build guide and the maze generator. Pick a start corner and print the maze.",
    cta: "Build a mouse",
    accent: "#5f2167",
  },
  { href: "/rules", title: "Rulebook", blurb: "The MMRC 26 rules, as a book you can flip through.", cta: "Read the rules", accent: "#97012d" },
  { href: "/game", title: "Pac Mouse", blurb: "Our maze game and its leaderboard. Still open, still beatable.", cta: "Play", accent: "#f2a900" },
  { href: "/gallery", title: "Gallery", blurb: "The day in photos, album by album.", cta: "See the photos", accent: "#732e7d" },
] as const;

/** The same maze every time: seed 26, a route long enough to watch. */
function creditsMaze() {
  const maze = pickMaze(10, 26, 46, 60, seededRandom(26));
  const route = maze.routes[0]!;
  return {
    viewBox: maze.viewBox,
    span: maze.size * CELL,
    walls: maze.walls,
    solution: route.solution,
    goal: maze.goal,
    cells: route.cells,
  };
}

const PLACE_STYLE: Record<1 | 2 | 3, string> = {
  1: "border-ras-crimson/40 bg-gradient-to-br from-ras-crimson/10 via-transparent to-ras-purple/10 sm:order-2 sm:-mt-6",
  2: "border-ras-gray/25 sm:order-1",
  3: "border-ras-gray/25 sm:order-3",
};

/**
 * The homepage once the competition is over: the credits and the developer's
 * letter first, then the thank-you, the podium, the day in numbers and photos,
 * the sponsors, and what stays open all year. Reads the public competition, so anything the desks still hold
 * back stays held back here.
 */
export async function WrapUpHome() {
  const [config, state, hidden, photos, sponsors, runs, matches, games, volunteers] = await Promise.all([
    getCompetitionDayConfig(),
    loadPublicCompetition(),
    hiddenPageHrefs(),
    loadDayPhotos(6),
    loadSlideSponsors(),
    prisma.qualifyingRun.count(),
    prisma.knockoutMatch.count({ where: { winnerId: { not: null } } }),
    prisma.gameScore.count(),
    prisma.volunteer.count({ where: { isPublished: true } }),
  ]);

  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const awards = awardsList(state.bracket, picksOf(config, (id) => state.byId.has(id)), config.awardsShown);
  const podium = config.awardsShown
    ? awards.filter((award): award is Award & { place: 1 | 2 | 3 } => award.kind === "place" && !!award.place && !!award.teamId)
    : [];
  const teams = state.competitors.filter((team) => !team.withdrawn).length;
  const checkedIn = state.competitors.filter((team) => team.checkedIn).length;

  const numbers = [
    { value: teams, label: "teams" },
    { value: checkedIn, label: "checked in on the day" },
    { value: runs, label: "qualifying runs" },
    { value: matches, label: "knockout matches" },
    { value: photos.count, label: "photos" },
    { value: games, label: "Pac Mouse games" },
  ].filter((number) => number.value > 0);

  // The day album is public once it is in the gallery, or while the day site
  // it lives on is open to everyone.
  const photosPublic = !!photos.album && (photos.album.isPublished || config.dayAudience === "PUBLIC");
  const photosHref = photos.album?.isPublished ? `/gallery/${photos.album.slug}` : "/day/photos";
  const cards = ALL_YEAR.filter((card) => !hidden.has(card.href));
  const place = config.venue.split(" - ")[0]?.trim();

  return (
    <>
      {/* The credits open the page: who made the site, then what it was for. */}
      <CreditsScene
        maze={creditsMaze()}
        name={DEVELOPER_NAME}
        role={DEVELOPER_ROLE}
        linkedIn={DEVELOPER_LINKEDIN}
        stats={BUILD_STATS}
        started={BUILD_STARTED}
        lines={[
          { role: "Organised by", name: "IEEE RAS HTU Student Chapter" },
          ...(teams ? [{ role: "Starring", name: `${teams} teams and their mice` }] : []),
          { role: "Run by", name: "The MMRC 26 committee" },
          ...(place ? [{ role: "Held at", name: place }] : []),
          { role: "Website", name: DEVELOPER_NAME },
        ]}
        paragraphs={messageParagraphs(config.developerMessage)}
      />

      <div className="mx-auto max-w-6xl px-4 py-16">
        <section className="text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-accent">
            {[config.dateText, place].filter(Boolean).join(" · ") || "IEEE RAS HTU Student Chapter"}
          </p>
          <h1 className="mt-3 font-display text-5xl font-extrabold text-ras-purple dark:text-white sm:text-6xl">MMRC 26 is a wrap</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ras-gray dark:text-white/70">
            Thank you to every team that built a mouse, every judge and volunteer on the floor, and every sponsor who backed
            it. Here is how it went, and what stays open until MMRC 27.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {!hidden.has("/results") ? (
              <Button asChild size="lg">
                <Link href="/results">See the results</Link>
              </Button>
            ) : null}
            <Button variant="ghost" asChild size="lg">
              <Link href="/journey">Take the journey</Link>
            </Button>
          </div>

          {numbers.length ? (
            <ul className="mx-auto mt-14 flex max-w-4xl flex-wrap justify-center gap-px overflow-hidden rounded-xl border border-ras-gray/15 bg-ras-gray/15">
              {numbers.map((number) => (
                <li key={number.label} className="min-w-[9rem] flex-1 basis-[calc(50%-1px)] bg-[var(--color-surface)] px-4 py-5 sm:basis-[calc(33.333%-1px)]">
                  <span className="block font-display text-3xl font-extrabold tabular-nums text-ras-purple dark:text-white">
                    {new Intl.NumberFormat("en-GB").format(number.value)}
                  </span>
                  <span className="mt-1 block text-sm text-ras-gray dark:text-white/60">{number.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {podium.length ? (
          <section className="mt-20" aria-labelledby="podium-title">
            <h2 id="podium-title" className="text-center font-display text-2xl font-bold text-ras-purple dark:text-white">
              The podium
            </h2>
            <ol className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              {podium.map((award) => (
                <li key={award.key} className={`rounded-xl border bg-[var(--color-surface)] p-6 text-center ${PLACE_STYLE[award.place]}`}>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{award.title}</p>
                  <p className={`mt-3 font-display font-extrabold text-ras-purple dark:text-white ${award.place === 1 ? "text-3xl" : "text-2xl"}`} dir="auto">
                    {nameOf(award.teamId)}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-center">
              <Link href="/results" className="font-semibold text-accent underline-offset-4 hover:underline">
                Every award, the knockout and the qualifying table
              </Link>
            </p>
          </section>
        ) : null}

        {photosPublic && photos.photos.length ? (
          <section className="mt-20" aria-labelledby="photos-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="photos-title" className="font-display text-2xl font-bold text-ras-purple dark:text-white">
                The day in photos
              </h2>
              <Link href={photosHref} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
                All {photos.count} photos
              </Link>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:[grid-auto-rows:11rem] lg:[grid-auto-rows:13rem]">
              {photos.photos.map((photo, i) => (
                <li key={photo.id} className={`overflow-hidden rounded-lg bg-ras-gray/10 ${i === 0 ? "col-span-2 row-span-2 aspect-[4/3] sm:aspect-auto" : "aspect-square sm:aspect-auto"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob storage URLs, already resized on upload */}
                  <img src={photo.url} alt={photo.caption || "A photo from MMRC 26"} loading="lazy" className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-20 text-center" aria-labelledby="thanks-title">
          <h2 id="thanks-title" className="font-display text-2xl font-bold text-ras-purple dark:text-white">
            Thank you
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-ras-gray dark:text-white/70">
            To the {teams ? `${teams} teams` : "teams"} who competed,{" "}
            {!hidden.has("/team") ? (
              <Link href="/team" className="font-semibold text-accent underline-offset-4 hover:underline">
                the committee
              </Link>
            ) : (
              "the committee"
            )}{" "}
            who ran it{volunteers ? `, the ${volunteers} volunteers` : ""}, and the sponsors who made it possible.
          </p>
          {sponsors.length ? (
            <ul className="mt-10 flex flex-wrap justify-center gap-4">
              {sponsors.map((sponsor) => (
                <li key={sponsor.id}>
                  <SponsorLogo
                    name={sponsor.name}
                    logoUrl={sponsor.logoUrl}
                    background={sponsor.logoBackground}
                    className="h-24 w-40 rounded-lg p-4 ring-1 ring-ras-gray/15 sm:h-28 sm:w-48"
                    nameClass="text-lg"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {cards.length ? (
          <section className="mt-24" aria-labelledby="all-year-title">
            <h2 id="all-year-title" className="text-center font-display text-2xl font-bold text-ras-purple dark:text-white">
              Open all year
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-ras-gray dark:text-white/70">
              Building for MMRC 27 already? These stay up between competitions.
            </p>
            <div className="stagger mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card, i) => (
                <FeatureCard key={card.href} card={card} accent={card.accent} seed={i + 1} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
