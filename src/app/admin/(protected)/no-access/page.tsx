import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection } from "@/lib/admin-access";
import { ROLE_LABELS, parseRoles } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Admin | Not your desk",
};

/** Where a screen outside this admin's roles sends them. */
export default async function NoAccessPage() {
  const admin = await requireSection("/admin/no-access");
  const roles = parseRoles(admin.roles);

  return (
    <div>
      <AdminPageHeader title="Not your desk" />
      <Card className="mt-6">
        <p className="text-sm text-ras-gray dark:text-white/70">
          {roles.length
            ? `Your account is set up for ${roles.map((role) => ROLE_LABELS[role]).join(", ")}, and that screen belongs to a different desk.`
            : "Your account has no role yet, so only the dashboard is open to you."}{" "}
          A master admin can change this on the Admins screen.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/admin/day" className="font-semibold text-accent hover:underline">
            Go to Day HQ →
          </Link>
        </p>
      </Card>
    </div>
  );
}
