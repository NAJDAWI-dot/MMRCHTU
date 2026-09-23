import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { QUALIFYING_STATUS_LABELS, phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { DAY_AUDIENCE_LABELS, parseAudience } from "@/lib/day-audience";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, canOpen } from "@/lib/roles";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { DESKS } from "./desks";

export const metadata: Metadata = { title: "Overview" };

/**
 * The competition day headquarters: one screen that shows where the day is,
 * and the desks this admin's roles open. Every role lands here.
 */
export default async function DayHqPage() {
  const admin = await requireSection("/day/hq");
  const roles = rolesOf(admin);
  const [state, config, alerts, announcements, volunteers, slots] = await Promise.all([
    loadCompetition(),
    getCompetitionDayConfig(),
    prisma.dayAnnouncement.count({ where: { isPublished: true, isAlert: true } }),
    prisma.dayAnnouncement.count({ where: { isPublished: true } }),
    prisma.volunteer.count(),
    prisma.daySlot.count(),
  ]);

  const total = state.competitors.length;
  const arrived = state.competitors.filter((team) => team.checkedIn).length;
  const passed = state.competitors.filter((team) => team.inspection === "PASSED").length;
  const ran = state.table.filter((row) => row.recorded).length;
  const playable = state.bracket.filter((match) => match.teamAId && match.teamBId && !match.walkover);
  const decided = playable.filter((match) => match.winnerId).length;
  const liveRound = state.bracket.find((match) => match.teamAId && match.teamBId && !match.winnerId)?.round;
  const champion = state.competitors.find((team) => team.journey.state === "CHAMPION");
  const audience = parseAudience(config.dayAudience);

  const stats = [
    { label: "Checked in", value: arrived, of: total, href: "/day/hq/check-in", tone: "bg-day-good" },
    { label: "Passed inspection", value: passed, of: total, href: "/day/hq/check-in", tone: "bg-day-plum" },
    { label: "Have run", value: ran, of: total, href: "/day/hq/scoring", tone: "bg-day-crimson" },
    { label: "Matches decided", value: decided, of: playable.length, href: "/day/hq/scoring/bracket", tone: "bg-day-gold" },
  ].filter((stat) => canOpen(roles, stat.href));

  const counts: Record<string, string> = {
    "/day/hq/announcements": `${announcements} live · ${alerts} alert${alerts === 1 ? "" : "s"}`,
    "/day/hq/volunteers": `${volunteers} people`,
    "/day/hq/access": DAY_AUDIENCE_LABELS[audience],
    "/day/hq/check-in": `${arrived} of ${total} here`,
    "/day/hq/scoring": `${ran} of ${total} have run`,
    "/day/hq/scoring/bracket": state.drawn ? `${decided} of ${playable.length} decided` : "Not drawn yet",
  };

  return (
    <div className="space-y-10">
      <section className="day-card relative overflow-hidden p-6 sm:p-10">
        <div className="day-stripe-x absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="day-kicker">
              Hello {admin.username} · {roles.length ? roles.map((role) => ROLE_LABELS[role]).join(", ") : "no role yet"}
            </p>
            <h1 className="day-display mt-3 text-4xl text-day-ink sm:text-6xl">
              {champion
                ? `${champion.name} are champions`
                : liveRound
                  ? `Phase ${liveRound} · ${phaseInfo(liveRound).name}`
                  : `Phase 1 · Qualifying`}
            </h1>
            <p className="mt-3 text-day-muted">
              {liveRound || champion ? "The knockout is under way." : `Qualifying: ${QUALIFYING_STATUS_LABELS[state.qualifyingStatus].toLowerCase()}.`} The day site is{" "}
              <span className="font-semibold text-day-ink">{DAY_AUDIENCE_LABELS[audience].toLowerCase()}</span>.
              {slots ? null : " No running order has been written on the Competition Day screen yet."}
            </p>
          </div>
          <Link href="/day" className="day-btn day-btn-ink">
            <DayIcon name="live" className="h-4 w-4" />
            Open the day site
          </Link>
        </div>

        {stats.length ? (
          <dl className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <Link key={stat.label} href={stat.href} className="day-sunk day-lift block p-4">
                <dt className="text-xs font-semibold text-day-muted">{stat.label}</dt>
                <dd className="day-num day-display mt-2 text-4xl text-day-ink">
                  {stat.value}
                  <span className="ml-1 text-base font-semibold text-day-faint">/ {stat.of}</span>
                </dd>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-day-ink/10" aria-hidden="true">
                  <div className={`h-full rounded-full ${stat.tone}`} style={{ width: `${stat.of ? Math.round((stat.value / stat.of) * 100) : 0}%` }} />
                </div>
              </Link>
            ))}
          </dl>
        ) : null}
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DESKS.filter((desk) => desk.href !== "/day/hq" && canOpen(roles, desk.href)).map((desk) => (
          <Link key={desk.href} href={desk.href} className="day-card day-lift group flex flex-col p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-day-crimson/10 text-day-crimson">
              <DayIcon name={desk.icon} className="h-6 w-6" />
            </span>
            <p className="day-display mt-6 text-2xl text-day-ink">{desk.label}</p>
            <p className="mt-1.5 flex-1 text-sm text-day-muted">{desk.blurb}</p>
            <p className="mt-5 flex items-center justify-between text-sm font-semibold text-day-ink">
              <span className="day-num text-day-faint">{counts[desk.href] ?? ""}</span>
              <DayIcon name="arrow" className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </p>
          </Link>
        ))}
        {canOpen(roles, "/admin/competition-day") ? (
          <Link href="/admin/competition-day" className="day-card day-lift group flex flex-col p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-day-crimson/10 text-day-crimson">
              <DayIcon name="schedule" className="h-6 w-6" />
            </span>
            <p className="day-display mt-6 text-2xl text-day-ink">Running order</p>
            <p className="mt-1.5 flex-1 text-sm text-day-muted">The day&rsquo;s timings, written on the Competition Day screen. The day site follows them.</p>
            <p className="mt-5 flex items-center justify-between text-sm font-semibold text-day-ink">
              <span className="day-num text-day-faint">{slots} line{slots === 1 ? "" : "s"}</span>
              <DayIcon name="arrow" className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </p>
          </Link>
        ) : null}
      </section>

      {roles.length === 0 ? (
        <p className="day-card p-6 text-day-muted">
          Your account has no role yet, so no desk is open to you. A Master admin can add one on the Admins screen.
        </p>
      ) : null}
    </div>
  );
}
