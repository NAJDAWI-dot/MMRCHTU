import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import {
  GAME_MODE_LABELS,
  IEEE_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  averageTeamSize,
  dailyCounts,
  orderBy,
  percent,
  tally,
  teamSizeSpread,
  topN,
} from "@/lib/analytics";
import { BarList, DayChart, Empty, Panel, StatTile } from "./AnalyticsCharts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = {
  title: "Analytics",
};

/** How far back the registration trend looks. Four weeks fits a build season. */
const TREND_DAYS = 28;

export default async function AnalyticsPage() {
  // Rows rather than groupBy: the dataset is small enough that one pass of
  // each table is cheaper than several round trips, and it lets the shaping
  // live in tested pure functions instead of in SQL.
  const [registrations, members, scores, faq, faqQuestions, lists, contacts, broadcasts] =
    await Promise.all([
      prisma.registration.findMany({
        select: { id: true, status: true, createdAt: true, memberCount: true },
      }),
      prisma.teamMember.findMany({
        select: { university: true, major: true, ieeeStatus: true, registrationId: true },
      }),
      prisma.gameScore.findMany({
        select: { mode: true, score: true, level: true, playerName: true },
      }),
      prisma.faqEntry.count({ where: { isPublished: true } }),
      prisma.faqQuestion.findMany({ select: { status: true } }),
      prisma.broadcastList.count(),
      prisma.broadcastContact.count(),
      prisma.broadcast.findMany({ select: { sentCount: true, failedCount: true } }),
    ]);

  const teamCount = registrations.length;
  const participantCount = members.length;

  const statusTally = orderBy(
    tally(registrations, (r) => r.status, { labels: REGISTRATION_STATUS_LABELS }),
    ["Pending", "Confirmed", "Waitlisted", "Cancelled"],
  );
  const confirmed = statusTally.find((s) => s.label === "Confirmed")?.value ?? 0;

  const trend = dailyCounts(
    registrations.map((r) => r.createdAt),
    TREND_DAYS,
  );
  const trendTotal = trend.reduce((sum, d) => sum + d.count, 0);

  // Team size comes from the members actually filled in, falling back to the
  // declared memberCount for teams registered before the member form existed.
  const membersPerTeam = new Map<string, number>();
  for (const m of members) {
    membersPerTeam.set(m.registrationId, (membersPerTeam.get(m.registrationId) ?? 0) + 1);
  }
  const sizes = registrations.map((r) => membersPerTeam.get(r.id) ?? r.memberCount);

  const ieeeTally = orderBy(
    tally(members, (m) => m.ieeeStatus, { labels: IEEE_STATUS_LABELS }),
    ["IEEE RAS member", "IEEE member", "Non-member"],
  );
  const ieeeMembers = members.filter((m) => m.ieeeStatus !== "NON_MEMBER").length;

  const modeTally = tally(scores, (s) => s.mode, { labels: GAME_MODE_LABELS });
  const distinctPlayers = new Set(scores.map((s) => s.playerName.trim().toLowerCase())).size;
  const topScore = scores.reduce((best, s) => Math.max(best, s.score), 0);
  const topLevel = scores.reduce((best, s) => Math.max(best, s.level), 0);

  const pendingQuestions = faqQuestions.filter((q) => q.status === "PENDING").length;
  const emailsSent = broadcasts.reduce((sum, b) => sum + b.sentCount, 0);
  const emailsFailed = broadcasts.reduce((sum, b) => sum + b.failedCount, 0);

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        subtitle="Everything below is counted live from the database. These numbers are admin-only — the public site no longer shows any of them."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value={teamCount} label="Teams registered" hint={`${confirmed} confirmed`} />
        <StatTile
          value={participantCount}
          label="Participants"
          hint={`${averageTeamSize(participantCount, teamCount)} per team on average`}
        />
        <StatTile
          value={ieeeMembers}
          label="IEEE members"
          hint={`${percent(ieeeMembers, participantCount)}% of participants`}
        />
        <StatTile
          value={scores.length}
          label="Pac Mouse plays"
          hint={`${distinctPlayers} distinct player${distinctPlayers === 1 ? "" : "s"}`}
        />
      </section>

      {/* items-start so a short panel keeps its own height instead of being
          stretched to match the tallest card in its row. */}
      <section className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Registrations over time"
          description={`Last ${TREND_DAYS} days — ${trendTotal} of ${teamCount} total landed in this window.`}
        >
          <DayChart data={trend} />
        </Panel>

        <Panel title="Status" description="Where each team currently sits.">
          <BarList data={statusTally} total={teamCount} />
        </Panel>

        <Panel
          title="IEEE membership"
          description="Drives the entry fee, so worth watching before invoicing."
        >
          <BarList data={ieeeTally} total={participantCount} />
        </Panel>

        <Panel title="Team size" description="How many people each registered team brings.">
          <BarList data={teamSizeSpread(sizes)} total={teamCount} />
        </Panel>

        <Panel title="Universities" description="Where participants are coming from.">
          <BarList data={topN(tally(members, (m) => m.university), 6)} total={participantCount} />
        </Panel>

        <Panel title="Majors" description="What participants study.">
          <BarList data={topN(tally(members, (m) => m.major), 6)} total={participantCount} />
        </Panel>

        <Panel title="Pac Mouse" description="Scores saved from the public game.">
          {scores.length === 0 ? (
            <Empty message="Nobody has saved a score yet." />
          ) : (
            <>
              <BarList data={modeTally} total={scores.length} />
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ras-gray/15 pt-3 text-sm">
                <div>
                  <dt className="text-ras-gray dark:text-white/60">Top score</dt>
                  <dd className="font-semibold text-ras-purple dark:text-white">{topScore}</dd>
                </div>
                <div>
                  <dt className="text-ras-gray dark:text-white/60">Highest level</dt>
                  <dd className="font-semibold text-ras-purple dark:text-white">{topLevel}</dd>
                </div>
              </dl>
            </>
          )}
        </Panel>

        <Panel title="Questions and email" description="Inbound interest and outbound reach.">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-ras-gray dark:text-white/60">Questions awaiting reply</dt>
            <dd className="text-right font-semibold text-ras-purple dark:text-white">
              {pendingQuestions}
            </dd>
            <dt className="text-ras-gray dark:text-white/60">Questions received</dt>
            <dd className="text-right font-semibold text-ras-purple dark:text-white">
              {faqQuestions.length}
            </dd>
            <dt className="text-ras-gray dark:text-white/60">Published FAQ entries</dt>
            <dd className="text-right font-semibold text-ras-purple dark:text-white">{faq}</dd>
            <dt className="text-ras-gray dark:text-white/60">Email lists</dt>
            <dd className="text-right font-semibold text-ras-purple dark:text-white">{lists}</dd>
            <dt className="text-ras-gray dark:text-white/60">Contacts on lists</dt>
            <dd className="text-right font-semibold text-ras-purple dark:text-white">{contacts}</dd>
            <dt className="text-ras-gray dark:text-white/60">Emails delivered</dt>
            <dd className="text-right font-semibold text-ras-purple dark:text-white">
              {emailsSent}
              {emailsFailed > 0 && (
                <span className="ml-1 font-normal text-accent">({emailsFailed} failed)</span>
              )}
            </dd>
          </dl>
        </Panel>
      </section>

      {teamCount === 0 && (
        <Card className="mt-6">
          <p className="text-sm text-ras-gray dark:text-white/70">
            No registrations yet, so most panels above are empty. They fill in on their own as
            teams sign up — nothing here needs setting up.
          </p>
        </Card>
      )}
    </div>
  );
}
