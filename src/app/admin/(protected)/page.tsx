import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default async function AdminDashboardPage() {
  const [registrationCount, pendingQuestionCount, upcomingEventCount] = await Promise.all([
    prisma.registration.count(),
    prisma.faqQuestion.count({ where: { status: "PENDING" } }),
    prisma.scheduleEvent.count({ where: { startsAt: { gte: new Date() } } }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-3xl font-extrabold text-ras-purple dark:text-white">{registrationCount}</p>
          <p className="mt-1 text-sm text-ras-gray dark:text-white/70">Registrations</p>
        </Card>
        <Card>
          <p className="text-3xl font-extrabold text-ras-purple dark:text-white">{pendingQuestionCount}</p>
          <p className="mt-1 text-sm text-ras-gray dark:text-white/70">Pending FAQ questions</p>
        </Card>
        <Card>
          <p className="text-3xl font-extrabold text-ras-purple dark:text-white">{upcomingEventCount}</p>
          <p className="mt-1 text-sm text-ras-gray dark:text-white/70">Upcoming schedule events</p>
        </Card>
      </div>
    </div>
  );
}
