import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { ArmedForm, DeskForm, Submit, inputClass, labelClass } from "../DeskKit";
import { DeskTabs } from "../DeskTabs";
import { addVolunteer, removeVolunteer, updateVolunteer } from "./actions";

export const metadata: Metadata = { title: "Admin | Volunteers" };

interface VolunteerRow {
  id: string;
  name: string;
  role: string;
  station: string;
  shift: string;
  phone: string;
  isPublished: boolean;
  sortOrder: number;
}

function Fields({ row, prefix, sortOrder }: { row?: VolunteerRow; prefix: string; sortOrder: number }) {
  const field = (name: keyof VolunteerRow, label: string, placeholder = "") => (
    <div>
      <label className={labelClass} htmlFor={`${prefix}-${name}`}>
        {label}
      </label>
      <input
        id={`${prefix}-${name}`}
        name={name}
        defaultValue={row ? String(row[name]) : ""}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {field("name", "Name")}
      {field("role", "Role", "Maze marshal")}
      {field("station", "Station", "Maze A")}
      {field("shift", "Shift", "09:00 to 13:00")}
      {field("phone", "Phone (never shown publicly)")}
      <div>
        <label className={labelClass} htmlFor={`${prefix}-sort`}>
          Order
        </label>
        <input
          id={`${prefix}-sort`}
          name="sortOrder"
          type="number"
          defaultValue={row?.sortOrder ?? sortOrder}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/70">
        <input type="checkbox" name="isPublished" defaultChecked={row ? row.isPublished : true} className="h-4 w-4" />
        Show on the day site
      </label>
    </div>
  );
}

/** Who is helping, where and when. Names, roles and stations go on the day site. */
export default async function VolunteersDeskPage() {
  const admin = await requireSection("/admin/day/volunteers");
  const volunteers = await prisma.volunteer.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const next = volunteers.length ? Math.max(...volunteers.map((v) => v.sortOrder)) + 10 : 10;
  const stations = new Set(volunteers.map((v) => v.station).filter(Boolean));

  return (
    <div>
      <AdminPageHeader
        title="Volunteers"
        subtitle={`${volunteers.length} volunteer${volunteers.length === 1 ? "" : "s"} across ${stations.size} station${stations.size === 1 ? "" : "s"}`}
      />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day/volunteers" />

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Add a volunteer
        </h2>
        <DeskForm action={addVolunteer} resetOnSuccess className="mt-3 space-y-3">
          <Fields prefix="new" sortOrder={next} />
          <Submit pending="Adding…">Add volunteer</Submit>
        </DeskForm>
      </Card>

      <div className="mt-6 space-y-3">
        {volunteers.map((row) => (
          <Card key={row.id}>
            <DeskForm action={updateVolunteer} className="space-y-3">
              <input type="hidden" name="id" value={row.id} />
              <Fields row={row} prefix={row.id} sortOrder={row.sortOrder} />
              <Submit pending="Saving…" size="sm">
                Save
              </Submit>
            </DeskForm>
            <div className="mt-2">
              <ArmedForm
                action={removeVolunteer}
                label="Remove"
                destructive
                confirm="Yes, remove"
                warning={`Remove ${row.name} from the list?`}
              >
                <input type="hidden" name="id" value={row.id} />
              </ArmedForm>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
