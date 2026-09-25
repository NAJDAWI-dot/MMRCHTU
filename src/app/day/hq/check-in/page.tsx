import type { Metadata } from "next";
import { requireSection } from "@/lib/admin-access";
import { loadCompetition } from "@/lib/competition";
import { clockTime } from "@/lib/day-mode";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { DeskHead } from "../DeskKit";
import { CheckInBoard, type CheckInTeam } from "./CheckInBoard";

export const metadata: Metadata = { title: "Check-in" };

const fee = (fils: number | null) => (fils === null ? "" : `${(fils / 1000).toFixed(fils % 1000 === 0 ? 0 : 2)} JOD`);

/**
 * The registration desk on the day. Contact details are shown here, and only
 * here: this is the one screen whose job is to reach a team that is late.
 */
export default async function CheckInPage() {
  await requireSection("/day/hq/check-in");
  const state = await loadCompetition();
  const rows = await prisma.registration.findMany({
    where: { id: { in: state.competitors.map((team) => team.id) } },
    select: {
      id: true,
      paymentStatus: true,
      feeDueFils: true,
      dayStatus: { select: { checkedInBy: true } },
      members: {
        orderBy: { order: "asc" },
        select: { id: true, firstName: true, lastName: true, university: true, email: true, whatsapp: true },
      },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const teams: CheckInTeam[] = state.competitors.map((team) => {
    const row = byId.get(team.id);
    const status = (row?.paymentStatus ?? "UNPAID") as PaymentStatus;
    return {
      id: team.id,
      name: team.name,
      members: (row?.members ?? []).map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`.trim(),
        university: member.university,
        email: member.email,
        phone: member.whatsapp,
      })),
      presentIds: team.presentIds,
      checkedIn: team.checkedIn,
      checkedInAt: team.checkedInAt ? clockTime(team.checkedInAt) : "",
      checkedInBy: row?.dayStatus?.checkedInBy ?? "",
      badges: team.badges,
      deskNote: team.deskNote,
      inspection: team.inspection,
      inspectionNote: team.inspectionNote,
      robotName: team.robotName,
      pit: team.pit,
      withdrawn: team.withdrawn,
      payment: {
        label: PAYMENT_STATUS_LABELS[status] ?? "Not paid",
        paid: status === "VERIFIED",
        due: status === "VERIFIED" ? "" : fee(row?.feeDueFils ?? null),
      },
      runOrder: team.runOrder,
    };
  });

  const here = teams.filter((team) => team.checkedIn).length;
  const people = teams.reduce((sum, team) => sum + team.presentIds.length, 0);
  const allPeople = teams.reduce((sum, team) => sum + team.members.length, 0);
  const inspected = teams.filter((team) => team.inspection === "PASSED").length;
  const badges = teams.filter((team) => team.badges).length;

  const tiles = [
    { label: "Teams here", value: here, of: teams.length, tone: "bg-day-good" },
    { label: "People here", value: people, of: allPeople, tone: "bg-day-plum" },
    { label: "Badges out", value: badges, of: here, tone: "bg-day-gold" },
    { label: "Inspected", value: inspected, of: here, tone: "bg-day-crimson" },
  ];

  return (
    <div className="space-y-8">
      <DeskHead icon="badge" title="Check-in" lead="Search, tap Check in, done. Open a team for its members, contacts, fee, badges, pit and inspection." />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="day-card p-4 sm:p-5">
            <dt className="text-xs font-semibold text-day-muted">{tile.label}</dt>
            <dd className="day-num day-display mt-2 text-4xl text-day-ink">
              {tile.value}
              <span className="ml-1 text-base font-semibold text-day-faint">/ {tile.of}</span>
            </dd>
            <div className="mt-3 h-1.5 overflow-hidden bg-day-ink/10" aria-hidden="true">
              <div className={`h-full ${tile.tone}`} style={{ width: `${tile.of ? Math.round((tile.value / tile.of) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </dl>

      {teams.length ? (
        <CheckInBoard teams={teams} />
      ) : (
        <p className="day-card p-6 text-day-muted">No confirmed teams yet. Confirmed registrations appear here.</p>
      )}
    </div>
  );
}
