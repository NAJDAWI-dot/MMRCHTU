import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { loadCompetition } from "@/lib/competition";
import { prisma } from "@/lib/prisma";
import { DAY_AUDIENCE_LABELS, parseAudience } from "@/lib/day-access";
import { QUALIFYING_STATUS_LABELS, phaseInfo } from "@/lib/bracket";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { ROLE_LABELS, canOpen } from "@/lib/roles";
import { DESKS, DeskTabs } from "./DeskTabs";

export const metadata: Metadata = { title: "Admin | Day HQ" };

/**
 * The competition day headquarters: one screen that shows where the day is,
 * and the desks this admin's roles open. Every role lands here.
 */
export default async function DayHqPage() {
  const admin = await requireSection("/admin/day");
  const roles = rolesOf(admin);
  const [state, config, announcements, volunteers] = await Promise.all([
    loadCompetition(),
    getCompetitionDayConfig(),
    prisma.dayAnnouncement.count({ where: { isPublished: true } }),
    prisma.volunteer.count(),
  ]);

  const arrived = state.competitors.filter((team) => team.checkedIn).length;
  const passed = state.competitors.filter((team) => team.inspection === "PASSED").length;
  const scored = state.table.filter((row) => row.rank !== null).length;
  const playable = state.bracket.filter((match) => match.teamAId && match.teamBId && !match.walkover);
  const decided = playable.filter((match) => match.winnerId).length;
  const liveRound = state.bracket.find((match) => match.teamAId && match.teamBId && !match.winnerId)?.round;
  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");

  const stats = [
    { label: "Teams here", value: `${arrived}/${state.competitors.length}`, href: "/admin/day/check-in" },
    { label: "Passed inspection", value: String(passed), href: "/admin/day/check-in" },
    { label: "Teams with a score", value: String(scored), href: "/admin/day/scoring" },
    {
      label: state.drawn ? "Matches decided" : "Bracket",
      value: state.drawn ? `${decided}/${playable.length}` : "Not drawn",
      href: "/admin/day/scoring/bracket",
    },
    { label: "Announcements live", value: String(announcements), href: "/admin/day/announcements" },
    { label: "Volunteers", value: String(volunteers), href: "/admin/day/volunteers" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Day HQ"
        subtitle={`Your desks: ${roles.length ? roles.map((role) => ROLE_LABELS[role]).join(", ") : "none yet"}`}
      />
      <DeskTabs roles={roles} current="/admin/day" />

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Where the day is</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ras-purple dark:text-white">
              {champion
                ? `${champion.name} are the champions`
                : liveRound
                  ? `Phase ${liveRound}: ${phaseInfo(liveRound).name}`
                  : `Phase 1: Qualifying (${QUALIFYING_STATUS_LABELS[state.qualifyingStatus].toLowerCase()})`}
            </p>
            <p className="mt-1 text-sm text-ras-gray dark:text-white/65">
              Day site: {DAY_AUDIENCE_LABELS[parseAudience(config.dayAudience)].toLowerCase()}
            </p>
          </div>
          <Link
            href="/day"
            className="rounded-md bg-ras-purple px-4 py-2 text-sm font-semibold text-white hover:bg-ras-purple/90"
          >
            Open the day site →
          </Link>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats
            .filter((stat) => canOpen(roles, stat.href))
            .map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="rounded-lg border border-ras-gray/15 p-3 transition-colors hover:border-ras-purple/40 dark:border-white/10"
              >
                <dt className="text-xs text-ras-gray dark:text-white/55">{stat.label}</dt>
                <dd className="mt-1 font-display text-2xl font-extrabold text-ras-purple dark:text-white">{stat.value}</dd>
              </Link>
            ))}
        </dl>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DESKS.filter((desk) => desk.href !== "/admin/day" && canOpen(roles, desk.href)).map((desk) => (
          <Link key={desk.href} href={desk.href} className="group">
            <Card interactive className="h-full">
              <p className="font-display text-lg font-bold text-ras-purple group-hover:text-accent dark:text-white">
                {desk.label} →
              </p>
              <p className="mt-1 text-sm text-ras-gray dark:text-white/65">{desk.blurb}</p>
            </Card>
          </Link>
        ))}
      </div>
      {roles.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ras-gray dark:text-white/70">
            Your account has no role yet, so no desk is open to you. A Master admin can add one on the Admins
            screen.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
