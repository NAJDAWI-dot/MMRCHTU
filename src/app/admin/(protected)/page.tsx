import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AdminGreeting } from "@/components/admin/AdminGreeting";
import { AdminIcon, type AdminIconName } from "@/components/admin/AdminIcons";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

/**
 * One queue of outstanding work, and where to go and clear it.
 *
 * The old dashboard showed three numbers and linked to nothing, so the one
 * question it should answer — is there anything waiting for me? — was the one
 * question you had to visit three other pages to settle.
 */
interface Attention {
  count: number;
  icon: AdminIconName;
  href: string;
  /** Written for count === 1 and count > 1 separately; English does not pluralise for free. */
  one: string;
  many: string;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  const [
    registrationCount,
    paidCount,
    upcomingEventCount,
    pendingPayments,
    pendingQuestions,
    pendingRegistrations,
  ] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { paymentStatus: "VERIFIED" } }),
    prisma.scheduleEvent.count({ where: { startsAt: { gte: new Date() } } }),
    prisma.registration.count({ where: { paymentStatus: "SUBMITTED" } }),
    prisma.faqQuestion.count({ where: { status: "PENDING" } }),
    prisma.registration.count({ where: { status: "PENDING" } }),
  ]);

  // Ordered by how much someone is waiting on the other end of it: a team that
  // has paid and is waiting to be told so first, then a person who asked a
  // question, then the internal review queue.
  const queues: Attention[] = [
    {
      count: pendingPayments,
      icon: "payments",
      href: "/admin/payments",
      one: "payment is waiting to be checked",
      many: "payments are waiting to be checked",
    },
    {
      count: pendingQuestions,
      icon: "faq",
      href: "/admin/faq",
      one: "question has not been answered",
      many: "questions have not been answered",
    },
    {
      count: pendingRegistrations,
      icon: "registrations",
      href: "/admin/registrations",
      one: "team is still pending review",
      many: "teams are still pending review",
    },
  ];
  const attention = queues.filter((item) => item.count > 0);

  const stats = [
    { label: "Teams registered", value: registrationCount },
    { label: "Paid", value: paidCount },
    { label: "Upcoming events", value: upcomingEventCount },
  ];

  return (
    <div className="space-y-6">
      <AdminGreeting
        username={admin.username}
        previousLoginAt={admin.previousLoginAt}
        createdAt={admin.createdAt}
      />

      <section aria-labelledby="needs-you">
        <h2
          id="needs-you"
          className="text-xs font-semibold uppercase tracking-widest text-ras-gray dark:text-white/50"
        >
          Needs you
        </h2>

        {attention.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-4 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-ras-purple/40 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/10"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white">
                    <AdminIcon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 text-sm text-ras-gray dark:text-white/80">
                    <strong className="font-display text-base font-extrabold text-ras-purple dark:text-white">
                      {item.count}
                    </strong>{" "}
                    {item.count === 1 ? item.one : item.many}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ms-auto shrink-0 text-ras-gray transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none dark:text-white/50"
                  >
                    &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          /* Said plainly rather than rendered as an empty container. "Nothing
             here" is a result, and it deserves a sentence. */
          <p className="mt-3 rounded-lg border border-dashed border-ras-gray/25 p-4 text-sm text-ras-gray dark:border-white/15 dark:text-white/70">
            Nothing is waiting. Every payment is checked, every question answered, and no team
            is left pending.
          </p>
        )}
      </section>

      <section aria-labelledby="at-a-glance">
        <h2
          id="at-a-glance"
          className="text-xs font-semibold uppercase tracking-widest text-ras-gray dark:text-white/50"
        >
          At a glance
        </h2>
        {/* A strip rather than three big tiles. These are context for the queue
            above, not the point of the page, and sizing them like a hero would
            say the opposite. */}
        <dl className="mt-3 grid grid-cols-3 divide-x divide-ras-gray/15 overflow-hidden rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] dark:divide-white/10 dark:border-white/10">
          {stats.map((stat) => (
            <div key={stat.label} className="p-4">
              <dd className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
                {stat.value}
              </dd>
              <dt className="mt-0.5 text-xs text-ras-gray dark:text-white/60">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
