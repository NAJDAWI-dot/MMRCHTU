import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getOpenDayConfig } from "@/lib/site-config";
import {
  openDayDateLabel,
  openDayPhase,
  resolveOpenDayWindow,
  toAmmanDateTimeLocal,
} from "@/lib/open-day";
import { updateOpenDay } from "./actions";

export const metadata: Metadata = {
  title: "Admin | Open Day",
};

// Never cached: the panel below states what the clock is doing right now, and
// a five minute old answer to that question is worse than no answer.
export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";
const hintClass = "mt-1 text-xs text-ras-gray dark:text-white/50";

const PHASE_SUMMARY = {
  before: "Counting down to the stand opening.",
  during: "The stand is open right now, and the clock is counting to closing time.",
  after: "The day is over. The clock says so, and the homepage slider has taken itself down.",
} as const;

export default async function AdminOpenDayPage() {
  const config = await getOpenDayConfig();
  const day = resolveOpenDayWindow(config);
  const phase = openDayPhase(day);
  // Whether the dates in force are the admin's own or the ones the code falls
  // back to. Worth saying out loud: the clock looks equally convincing either
  // way, and an admin who has never opened this tab has no other way to tell.
  const usingDefaults = !config.startsAt && !config.endsAt;

  return (
    <div>
      <AdminPageHeader
        title="Open Day"
        subtitle={
          <>
            The countdown on{" "}
            <Link href="/open-day" className="font-semibold text-accent hover:underline">
              /open-day
            </Link>{" "}
            and the slider at the top of the homepage. To hide the open day page itself, use the
            Pages tab.
          </>
        }
      />

      <Card className="mt-6 border-ras-purple/30 bg-ras-purple/5 dark:bg-white/5">
        <h2 className="font-display font-bold text-ras-purple dark:text-white">Right now</h2>
        <p className="mt-2 text-sm text-ras-gray dark:text-white/75">
          {config.enabled ? PHASE_SUMMARY[phase] : "The countdown is switched off everywhere."}
        </p>
        <p className="mt-1 text-sm font-semibold text-ras-purple dark:text-white">
          {openDayDateLabel(day)}
          {config.location ? ` · ${config.location}` : ""}
        </p>
        {usingDefaults ? (
          <p className={hintClass}>
            These are the dates written into the code, because nothing has been saved here yet.
            Set them below and they take over.
          </p>
        ) : null}
      </Card>

      <form action={updateOpenDay}>
        <Card className="mt-4">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">When</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="startsAt">
                Doors open
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={toAmmanDateTimeLocal(config.startsAt)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="endsAt">
                Stand packs up
              </label>
              <input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={toAmmanDateTimeLocal(config.endsAt)}
                className={inputClass}
              />
            </div>
          </div>
          <p className={hintClass}>
            Amman time, whatever timezone your own computer is set to. Clear both to go back to
            the dates in the code. An end time before its start is ignored and the stand is given
            six hours instead.
          </p>
        </Card>

        <Card className="mt-4">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Where</h2>
          <div className="mt-3">
            <label className={labelClass} htmlFor="location">
              Location
            </label>
            <input
              id="location"
              name="location"
              placeholder="e.g. HTU Main Hall, stand 12"
              defaultValue={config.location}
              className={inputClass}
              maxLength={120}
            />
            <p className={hintClass}>
              Shown under the clock on the open day page and on the homepage slider. Leave it
              empty and neither mentions a place.
            </p>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="font-display font-bold text-ras-purple dark:text-white">Where it shows</h2>
          <div className="mt-3 grid gap-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ras-gray/20 p-3 text-sm">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={config.enabled}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-ras-purple dark:text-white">
                  Show the countdown
                </span>
                <span className="block text-xs text-ras-gray dark:text-white/60">
                  Off removes the clock from the open day page and the slider from the homepage.
                  The open day page itself stays up.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ras-gray/20 p-3 text-sm">
              <input
                type="checkbox"
                name="showOnHome"
                defaultChecked={config.showOnHome}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-ras-purple dark:text-white">
                  Slider at the top of the homepage
                </span>
                <span className="block text-xs text-ras-gray dark:text-white/60">
                  A band above MMRC 26 carrying the clock, the crest and the game. It takes itself
                  down once the day is over, whatever this says.
                </span>
              </span>
            </label>
          </div>
        </Card>

        <div className="mt-4">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}
