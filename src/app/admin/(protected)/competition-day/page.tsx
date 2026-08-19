import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  COMPETITION_DAY_STATUSES,
  COMPETITION_DAY_STATUS_HINTS,
  COMPETITION_DAY_STATUS_LABELS,
  parseStatus,
  toDateTimeLocal,
} from "@/lib/competition-day";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { updateCompetitionDay } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Competition Day",
};

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export default async function AdminCompetitionDayPage() {
  const config = await getCompetitionDayConfig();
  const current = parseStatus(config.status);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Competition Day</h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        Controls the public{" "}
        <Link href="/competition-day" className="font-semibold text-ras-crimson hover:underline">
          /competition-day
        </Link>{" "}
        page. Write the details whenever you like — nothing is shown to visitors until you set the status to
        Published.
      </p>

      <form action={updateCompetitionDay}>
        <Card className="mt-6">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Status</h2>
          <div className="mt-3 grid gap-2">
            {COMPETITION_DAY_STATUSES.map((status) => (
              <label
                key={status}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-ras-gray/20 p-3 text-sm"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  defaultChecked={current === status}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold text-ras-purple dark:text-white">
                    {COMPETITION_DAY_STATUS_LABELS[status]}
                  </span>
                  <span className="block text-xs text-ras-gray dark:text-white/60">
                    {COMPETITION_DAY_STATUS_HINTS[status]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Always shown</h2>
          <div className="mt-3 grid gap-4">
            <div>
              <label className={labelClass} htmlFor="headline">
                Page heading
              </label>
              <input id="headline" name="headline" defaultValue={config.headline} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="intro">
                Intro line (optional)
              </label>
              <input id="intro" name="intro" defaultValue={config.intro} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="comingSoonText">
                Holding message (shown while the status is “Coming soon”)
              </label>
              <input
                id="comingSoonText"
                name="comingSoonText"
                defaultValue={config.comingSoonText}
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Shown once published</h2>
          <div className="mt-3 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="dateText">
                  Date
                </label>
                <input
                  id="dateText"
                  name="dateText"
                  placeholder="e.g. Saturday 18 April 2026"
                  defaultValue={config.dateText}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="venue">
                  Venue
                </label>
                <input
                  id="venue"
                  name="venue"
                  placeholder="e.g. HTU Main Hall"
                  defaultValue={config.venue}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="eventDate">
                Exact start (drives the countdown)
              </label>
              <input
                id="eventDate"
                name="eventDate"
                type="datetime-local"
                defaultValue={toDateTimeLocal(config.eventDate)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ras-gray dark:text-white/50">
                Optional, and separate from the Date text above so that can stay
                friendly (&ldquo;mid-April&rdquo;) while the clock has something exact. Set it and a
                live countdown appears on the homepage and the competition day page; clear it and
                the countdown disappears. Uses your own timezone.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="details">
                Details
              </label>
              <textarea
                id="details"
                name="details"
                rows={12}
                defaultValue={config.details}
                placeholder={"Check-in opens at 09:00.\n\nPractice runs run until 11:00, then qualifying begins."}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
                Plain text. Leave a blank line between paragraphs. Formatting tags are not rendered.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-4">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}
