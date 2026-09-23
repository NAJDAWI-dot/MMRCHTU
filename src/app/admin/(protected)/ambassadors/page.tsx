import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PaymentBadge } from "@/components/payment/PaymentBadge";
import { siteOrigin } from "@/lib/site-url";
import { setAmbassadorStatus } from "./actions";
import { CopyLink, CreateAmbassadorForm, RemoveAmbassador } from "./AmbassadorControls";
import { requireSection } from "@/lib/admin-access";

export const metadata: Metadata = {
  title: "Admin | Ambassadors",
};

/**
 * The address this admin page was opened on, so a share link copied from a
 * preview deployment points at that preview and one copied in production points
 * at the live site.
 */
function requestOrigin(): string {
  const list = headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return siteOrigin();
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function AdminAmbassadorsPage() {
  await requireSection("/admin/ambassadors");
  const [ambassadors, totalTeams, unmatched] = await Promise.all([
    prisma.ambassador.findMany({
      include: {
        registrations: {
          select: { id: true, teamName: true, createdAt: true, paymentStatus: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.registration.count(),
    // Codes teams typed that no longer point at anyone: the ambassador was
    // removed, or was paused while the team was on the payment step.
    prisma.registration.groupBy({
      by: ["referralCode"],
      where: { referralCode: { not: "" }, ambassadorId: null },
      _count: { _all: true },
    }),
  ]);

  // Most signups first, so the page reads as a leaderboard.
  const rows = ambassadors
    .map((a) => ({
      ...a,
      count: a.registrations.length,
      paid: a.registrations.filter((r) => r.paymentStatus === "VERIFIED").length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const referred = rows.reduce((sum, a) => sum + a.count, 0);
  const active = rows.filter((a) => a.status === "ACTIVE").length;
  const origin = requestOrigin();

  return (
    <div>
      <AdminPageHeader
        title="Ambassadors"
        subtitle={`${rows.length} code${rows.length === 1 ? "" : "s"} · ${active} active · ${referred} of ${totalTeams} teams came in on a code`}
      />

      <Card>
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          New referral code
        </h2>
        <div className="mt-3">
          <CreateAmbassadorForm />
        </div>
      </Card>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-ras-gray/25 p-6 text-sm text-ras-gray dark:border-white/15 dark:text-white/70">
          No ambassadors yet. Create a code above, then send the ambassador their link.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((a) => {
            const link = `${origin}/register?ref=${encodeURIComponent(a.code)}`;
            const paused = a.status !== "ACTIVE";
            return (
              <Card key={a.id} className={paused ? "opacity-80" : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold text-ras-purple dark:text-white">{a.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          paused
                            ? "bg-[#F2A900]/20 text-[#8a6200] dark:text-[#F2A900]"
                            : "bg-ras-purple/15 text-ras-purple dark:bg-white/15 dark:text-white"
                        }`}
                      >
                        {paused ? "Paused" : "Active"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ras-gray dark:text-white/60">
                      {a.university || "No university set"}
                    </p>
                    <p className="mt-2 font-mono text-lg font-extrabold tracking-wider text-ras-purple dark:text-white">
                      {a.code}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-3xl font-extrabold leading-none text-ras-purple dark:text-white">
                      {a.count}
                    </p>
                    <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
                      team{a.count === 1 ? "" : "s"} registered · {a.paid} paid
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <CopyLink url={link} />
                  <form action={setAmbassadorStatus}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value={paused ? "ACTIVE" : "PAUSED"} />
                    <Button type="submit" variant="secondary" size="sm">
                      {paused ? "Resume" : "Pause"}
                    </Button>
                  </form>
                  <RemoveAmbassador id={a.id} name={a.name} count={a.count} />
                </div>

                {a.count > 0 ? (
                  <details className="mt-3 rounded-md border border-ras-gray/20 p-3 dark:border-white/10">
                    <summary className="cursor-pointer text-xs font-semibold text-ras-gray dark:text-white/70">
                      Teams on this code
                    </summary>
                    <ul className="mt-2 divide-y divide-ras-gray/10 text-sm dark:divide-white/10">
                      {a.registrations.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                          <span className="text-ras-gray dark:text-white/80">{r.teamName}</span>
                          <span className="flex items-center gap-2 text-xs text-ras-gray dark:text-white/60">
                            {r.createdAt.toLocaleDateString()}
                            <PaymentBadge status={r.paymentStatus} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {unmatched.length > 0 ? (
        <Card className="mt-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
            Codes that count for nobody
          </h2>
          <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
            Teams typed these, but the ambassador has since been removed, or their code was paused
            while the team was paying.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unmatched.map((u) => (
              <li
                key={u.referralCode}
                className="rounded-md border border-ras-gray/20 px-2 py-1 font-mono text-xs text-ras-gray dark:border-white/10 dark:text-white/70"
              >
                {u.referralCode} · {u._count._all}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
