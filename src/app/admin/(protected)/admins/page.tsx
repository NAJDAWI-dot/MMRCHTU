import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteAdmin, signOutEverywhere, updateRoles } from "./actions";
import { RoleChecks } from "./RoleChecks";
import { ROLE_LABELS, parseRoles } from "@/lib/roles";
import { CreateAdminForm } from "./CreateAdminForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireSection } from "@/lib/admin-access";

export const metadata: Metadata = {
  title: "Admin | Admins",
};

export default async function AdminAdminsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireSection("/admin/admins");
  const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <AdminPageHeader title="Admins" />

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Create admin
        </h2>
        <div className="mt-3">
          <CreateAdminForm />
        </div>
      </Card>

      {searchParams?.error === "last-master" ? (
        <p role="alert" className="mt-6 rounded-md bg-ras-crimson/10 px-3 py-2 text-sm text-accent">
          That is the last Master account. Make someone else a Master first, or nobody will be able
          to open this screen again.
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {admins.map((admin) => (
          <Card key={admin.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ras-purple dark:text-white">{admin.username}</p>
                <p className="text-xs text-ras-gray dark:text-white/60">
                  {parseRoles(admin.roles).map((role) => ROLE_LABELS[role]).join(" · ") || "No role"} · Last
                  login: {admin.lastLoginAt ? admin.lastLoginAt.toLocaleString() : "Never"}
                </p>
              </div>
              {admins.length > 1 ? (
                <form action={deleteAdmin}>
                  <input type="hidden" name="id" value={admin.id} />
                  <Button type="submit" variant="ghost" className="text-accent">
                    Remove
                  </Button>
                </form>
              ) : null}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-accent">Change roles</summary>
              <form action={updateRoles} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={admin.id} />
                <RoleChecks idPrefix={admin.id} selected={parseRoles(admin.roles)} />
                <Button type="submit" size="sm">
                  Save roles
                </Button>
              </form>
            </details>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Your sessions
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ras-gray dark:text-white/70">
          Signing in leaves a session that lasts a week. If you have signed in on a shared or lost
          device, this signs out all of them at once, including this browser, so you will need to
          sign in again. It does not affect other admins.
        </p>
        <form action={signOutEverywhere} className="mt-3">
          <Button type="submit" variant="ghost" className="text-accent">
            Sign out everywhere
          </Button>
        </form>
      </Card>
    </div>
  );
}
