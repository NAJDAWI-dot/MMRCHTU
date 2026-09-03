import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createEvent, updateEvent, deleteEvent } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Schedule",
};

function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export default async function AdminSchedulePage() {
  const events = await prisma.scheduleEvent.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Schedule</h1>

      <Card className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Add event
        </h2>
        <form action={createEvent} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Title</label>
            <input name="title" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input name="location" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Starts at</label>
            <input name="startsAt" type="datetime-local" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Ends at (optional)</label>
            <input name="endsAt" type="datetime-local" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sort order</label>
            <input name="sortOrder" type="number" defaultValue={events.length} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea name="description" required rows={2} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Add event</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {events.map((event) => (
          <Card key={event.id}>
            <form action={updateEvent} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={event.id} />
              <div>
                <label className={labelClass}>Title</label>
                <input name="title" defaultValue={event.title} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input name="location" defaultValue={event.location ?? ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Starts at</label>
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toLocalInputValue(event.startsAt)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Ends at (optional)</label>
                <input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={toLocalInputValue(event.endsAt)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sort order</label>
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={event.sortOrder}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea name="description" defaultValue={event.description} required rows={2} className={inputClass} />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Save</Button>
              </div>
            </form>
            <form action={deleteEvent} className="mt-2">
              <input type="hidden" name="id" value={event.id} />
              <Button type="submit" variant="ghost" className="text-accent">
                Delete
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
