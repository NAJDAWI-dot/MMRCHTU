import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteAdmin, signOutEverywhere } from "./actions";
import { CreateAdminForm } from "./CreateAdminForm";

export const metadata: Metadata = {
  title: "Admin — Admins",
};

export default async function AdminAdminsPage() {
  const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Admins</h1>

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Create admin
        </h2>
        <div className="mt-3">
          <CreateAdminForm />
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {admins.map((admin) => (
          <Card key={admin.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ras-purple dark:text-white">{admin.username}</p>
              <p className="text-xs text-ras-gray dark:text-white/60">
                Last login: {admin.lastLoginAt ? admin.lastLoginAt.toLocaleString() : "Never"}
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
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Your sessions
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ras-gray dark:text-white/70">
          Signing in leaves a session that lasts a week. If you have signed in on a shared or lost
          device, this ends every one of them at once — including this browser, so you will be asked
          to sign in again. It does not affect other admins.
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
