import type { Metadata } from "next";
import { requireSection } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { ArmedForm, DeskForm, DeskHead, Submit, Toggle, inputClass, labelClass } from "../DeskKit";
import { addVolunteer, removeVolunteer, updateVolunteer } from "./actions";

export const metadata: Metadata = { title: "Volunteers" };

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
      <div className="flex items-end pb-2">
        <Toggle name="isPublished" defaultChecked={row ? row.isPublished : true} label="Show on the day site" />
      </div>
    </div>
  );
}

/** Who is helping, where and when. Names, roles and stations go on the day site. */
export default async function VolunteersDeskPage() {
  await requireSection("/day/hq/volunteers");
  const volunteers = await prisma.volunteer.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const next = volunteers.length ? Math.max(...volunteers.map((v) => v.sortOrder)) + 10 : 10;
  const stations = new Set(volunteers.map((v) => v.station).filter(Boolean));

  return (
    <div className="space-y-8">
      <DeskHead
        icon="hand"
        title="Volunteers"
        lead={`${volunteers.length} volunteer${volunteers.length === 1 ? "" : "s"} across ${stations.size} station${stations.size === 1 ? "" : "s"}. Names, roles, stations and shifts go on the day site; phone numbers never do.`}
      />

      <section className="day-card p-5 sm:p-6">
        <h2 className="day-display text-2xl text-day-ink">Add a volunteer</h2>
        <DeskForm action={addVolunteer} resetOnSuccess className="mt-3 space-y-3">
          <Fields prefix="new" sortOrder={next} />
          <Submit pending="Adding…">Add volunteer</Submit>
        </DeskForm>
      </section>

      <div className="space-y-3">
        {volunteers.map((row) => (
          <section key={row.id} className="day-card p-5">
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
          </section>
        ))}
      </div>
    </div>
  );
}
