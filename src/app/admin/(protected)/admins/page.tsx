import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteAdmin } from "./actions";
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
                <Button type="submit" variant="ghost" className="text-ras-crimson">
                  Remove
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
