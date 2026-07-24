import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updateRegistrationStatus } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Registrations",
};

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "WAITLISTED", "CANCELLED"];

export default async function AdminRegistrationsPage() {
  const registrations = await prisma.registration.findMany({
    include: { members: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Registrations</h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">{registrations.length} teams registered.</p>

      <div className="mt-6 space-y-4">
        {registrations.map((reg) => (
          <Card key={reg.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display font-bold text-ras-purple dark:text-white">{reg.teamName}</p>
                <p className="text-xs text-ras-gray dark:text-white/60">
                  {reg.submitterEmail} · {reg.memberCount} member{reg.memberCount > 1 ? "s" : ""} ·{" "}
                  {reg.createdAt.toLocaleDateString()}
                </p>
              </div>
              <form action={updateRegistrationStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={reg.id} />
                <select
                  name="status"
                  defaultValue={reg.status}
                  className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  Update
                </Button>
              </form>
            </div>

            <ul className="mt-3 space-y-1 text-sm text-ras-gray dark:text-white/80">
              {reg.members.map((m) => (
                <li key={m.id}>
                  {m.order === 1 ? "Team Leader" : `Member ${m.order}`}: {m.firstName} {m.lastName} — {m.university},{" "}
                  {m.major} — {m.ieeeStatus} ({m.ieeeMembershipId}) — {m.email} / {m.whatsapp}
                </li>
              ))}
            </ul>

            <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
              <strong>Experience:</strong> {reg.technicalExperience}
            </p>
            <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
              <strong>Motivation:</strong> {reg.motivation}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
