import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TeamMice } from "@/components/team/TeamMice";
import { TributeStage, type TributePerson } from "@/components/team/TributeStage";
import { TributeTrigger } from "@/components/team/TributeTrigger";
import {
  COMMITTEE_RANK_LABELS,
  buildRoster,
  initials,
  isCommitteeRank,
  rosterSize,
} from "@/lib/roster";

// The committee changes a few times a year and every admin save revalidates
// this path explicitly, so the window only covers the gap between a direct
// database edit and the page noticing.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Committee",
  description:
    "Meet the IEEE RAS HTU students who organise MMRC 26: the chair, the co-chair and every department behind the competition.",
};

/**
 * The people who run the competition.
 *
 * The hierarchy is carried by the shape of the page rather than by labels
 * alone: the chair and co-chair get a panel of their own, department heads get
 * a row above the people they lead, and members are compact tiles with no card
 * chrome at all. Three different treatments, so the structure is legible
 * before a single role is read — which the same card repeated forty times
 * would not manage no matter what the captions said.
 *
 * Anybody who has had an honourable mention written for them also opens: their
 * card becomes a button, and the tribute is shown on a stage of their own. The
 * card markup below stays on the server and is handed to the trigger as
 * children, so making the page clickable does not send it to the browser.
 *
 * One consequence, and it is the reason the cards below are built out of spans:
 * a button may only contain phrasing content, so no <p> or <div> can appear
 * inside one of these cards.
 */

type Member = {
  id: string;
  name: string;
  role: string;
  rank: string;
  photoUrl: string | null;
  stageUrl: string | null;
  tribute: string;
};

function roleLabel(member: Member): string {
  if (member.role.trim()) return member.role.trim();
  // Falls back to the rank so a card is never captionless. Someone added in a
  // hurry with no job title still reads as a member of something.
  return isCommitteeRank(member.rank) ? COMMITTEE_RANK_LABELS[member.rank] : "Committee";
}

function hasTribute(member: Member): boolean {
  return member.tribute.trim().length > 0;
}

/** The shape the popup wants, with the role already resolved. */
function toPerson(member: Member, department: string | null): TributePerson {
  return {
    id: member.id,
    name: member.name,
    role: roleLabel(member),
    department,
    photoUrl: member.photoUrl,
    stageUrl: member.stageUrl,
    tribute: member.tribute,
  };
}

/** The mark on a face that has a mention, and the key that explains it. */
function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function Portrait({
  member,
  size,
  ringed,
  marked,
}: {
  member: Member;
  size: number;
  ringed?: boolean;
  /** Whether this person has a mention waiting behind their card. */
  marked?: boolean;
}) {
  const ring = ringed
    ? "ring-2 ring-accent/70 ring-offset-4 ring-offset-[var(--color-bg)]"
    : "ring-1 ring-ras-purple/15 dark:ring-white/15";

  const face = member.photoUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element -- blob-stored portrait, already downscaled at upload */
    <img
      src={member.photoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className={`rounded-full object-cover ${ring}`}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
      className={`grid place-items-center rounded-full bg-gradient-to-br from-ras-purple/15 to-ras-crimson/15 font-display font-extrabold text-ras-purple dark:from-white/15 dark:to-white/5 dark:text-white ${ring}`}
    >
      {initials(member.name)}
    </span>
  );

  if (!marked) return face;

  /*
    Hover was the only thing saying a card could be opened, which told mouse
    users and told nobody on a phone at all — where most of this will be read.
    The star is the same signal, standing still, on every device.

    Sat at 82% along both axes so it lands on the lower-right of the circle
    rather than floating off the corner of its box, and ringed in the page
    background so it separates from a dark photograph behind it.
  */
  const badge = Math.max(18, Math.round(size / 4.4));

  return (
    <span className="relative inline-flex">
      {face}
      <span
        aria-hidden="true"
        style={{
          left: "82%",
          top: "82%",
          width: badge,
          height: badge,
          transform: "translate(-50%, -50%)",
        }}
        className="absolute grid place-items-center rounded-full bg-ras-crimson text-white ring-2 ring-[var(--color-bg)]"
      >
        <Star className="h-1/2 w-1/2" />
      </span>
    </span>
  );
}

/** The chair and co-chair: the only people who get a panel to themselves. */
function LeadCard({ member }: { member: Member }) {
  return (
    <TributeTrigger
      id={member.id}
      hasTribute={hasTribute(member)}
      className="relative block w-full overflow-hidden rounded-2xl border border-ras-purple/20 bg-gradient-to-br from-ras-purple/10 via-transparent to-ras-crimson/10 p-6 text-center dark:border-white/10"
    >
      <span className="flex justify-center">
        <Portrait member={member} size={132} ringed marked={hasTribute(member)} />
      </span>
      <span className="mt-5 block font-display text-xl font-extrabold text-ras-purple dark:text-white">
        {member.name}
      </span>
      <span className="mt-1 block text-sm font-semibold uppercase tracking-wide text-accent">
        {roleLabel(member)}
      </span>
    </TributeTrigger>
  );
}

/** A department head: a row of their own, above the people they lead. */
function HeadCard({ member }: { member: Member }) {
  return (
    <TributeTrigger
      id={member.id}
      hasTribute={hasTribute(member)}
      className="flex w-full items-center gap-4 rounded-xl border border-ras-gray/20 bg-[var(--color-surface)] p-4 text-left dark:border-white/10"
    >
      <Portrait member={member} size={72} ringed marked={hasTribute(member)} />
      <span className="block min-w-0">
        <span className="block truncate font-display text-base font-bold text-ras-purple dark:text-white">
          {member.name}
        </span>
        <span className="block truncate text-sm text-ras-gray dark:text-white/70">
          {roleLabel(member)}
        </span>
      </span>
    </TributeTrigger>
  );
}

/** Everyone else: no border, no shadow — a face and a name. */
function MemberTile({ member }: { member: Member }) {
  return (
    <li>
      <TributeTrigger
        id={member.id}
        hasTribute={hasTribute(member)}
        className="flex w-full flex-col items-center rounded-xl p-2 text-center"
      >
        <Portrait member={member} size={88} marked={hasTribute(member)} />
        <span className="mt-3 block font-semibold text-ras-purple dark:text-white">
          {member.name}
        </span>
        <span className="block text-xs text-ras-gray dark:text-white/60">{roleLabel(member)}</span>
      </TributeTrigger>
    </li>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        <h2 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
          {title}
        </h2>
        {/* A rule that runs to the edge, rather than a box around the heading. */}
        <span aria-hidden="true" className="h-px flex-1 bg-ras-gray/25 dark:bg-white/15" />
      </div>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-ras-gray dark:text-white/70">{description}</p>
      ) : null}
    </div>
  );
}

export default async function TeamPage() {
  const [departments, members] = await Promise.all([
    prisma.committeeDepartment.findMany(),
    // Only published people. Somebody can be added and arranged before an
    // announcement without appearing on the site in the meantime.
    prisma.committeeMember.findMany({ where: { isPublished: true } }),
  ]);

  const roster = buildRoster(departments, members);
  const total = rosterSize(roster);
  const filled = roster.groups.filter(
    (group) => group.heads.length + group.members.length > 0,
  );

  // Flattened in the order the page reads, top to bottom, because that is the
  // order the popup's arrows walk. A visitor stepping through the committee is
  // moving down the page, not through a query result.
  const people: TributePerson[] = [
    ...roster.leadership.map((member) => toPerson(member, null)),
    ...filled.flatMap((group) => [
      ...group.heads.map((member) => toPerson(member, group.department.name)),
      ...group.members.map((member) => toPerson(member, group.department.name)),
    ]),
    ...roster.unassigned.map((member) => toPerson(member, null)),
  ];

  const markedCount = people.filter((person) => person.tribute.trim().length > 0).length;

  return (
    <TributeStage people={people}>
      <div className="relative mx-auto max-w-5xl px-4 py-16">
        <TeamMice />

        <header className="relative text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            IEEE RAS HTU Student Chapter
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-ras-purple dark:text-white sm:text-5xl">
            The Committee
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ras-gray dark:text-white/70">
            MMRC 26 is built by students. These are the people who write the rules, run the desk,
            judge the runs and look after the mazes. You&apos;ll find them at the venue on the day if you
            need anything.
          </p>

          {/*
            The key to the stars. Without it the marks are decoration and the
            mentions go unread — a hover state tells mouse users and tells
            nobody on a phone, which is where most of this will be read.

            Shown only once somebody actually has a mention, so the page never
            invites a visitor to look for something that is not there yet.
          */}
          {markedCount > 0 ? (
            <p className="mx-auto mt-6 inline-flex items-center gap-2.5 rounded-full border border-ras-purple/25 bg-[var(--color-surface)] px-4 py-2 text-sm text-ras-gray dark:border-white/15 dark:text-white/75">
              <Star className="h-3.5 w-3.5 shrink-0 text-ras-crimson dark:text-accent" />
              Click or tap a starred face to read their honourable mention.
            </p>
          ) : null}
        </header>

        {total === 0 ? (
          <div className="relative mt-16 rounded-2xl border border-ras-gray/20 bg-[var(--color-surface)] p-10 text-center">
            <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
              Still being introduced
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ras-gray dark:text-white/70">
              The committee will be announced here shortly.
            </p>
          </div>
        ) : null}

        {roster.leadership.length > 0 ? (
          <section className="relative mt-14">
            <div
              className={`mx-auto grid gap-5 ${
                roster.leadership.length === 1 ? "max-w-sm" : "max-w-3xl sm:grid-cols-2"
              }`}
            >
              {roster.leadership.map((member) => (
                <LeadCard key={member.id} member={member} />
              ))}
            </div>
          </section>
        ) : null}

        {filled.map((group) => (
          <section key={group.department.id} className="relative mt-16">
            <SectionHeading
              title={group.department.name}
              description={group.department.description || undefined}
            />

            {group.heads.length > 0 ? (
              <div
                className={`mb-8 grid gap-4 ${group.heads.length === 1 ? "sm:max-w-sm" : "sm:grid-cols-2"}`}
              >
                {group.heads.map((member) => (
                  <HeadCard key={member.id} member={member} />
                ))}
              </div>
            ) : null}

            {group.members.length > 0 ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {group.members.map((member) => (
                  <MemberTile key={member.id} member={member} />
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        {roster.unassigned.length > 0 ? (
          <section className="relative mt-16">
            <SectionHeading title="Also on the committee" />
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {roster.unassigned.map((member) => (
                <MemberTile key={member.id} member={member} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </TributeStage>
  );
}
