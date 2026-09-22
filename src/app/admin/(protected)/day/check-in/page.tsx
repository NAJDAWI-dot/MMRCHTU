import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { loadCompetition } from "@/lib/competition";
import { INSPECTION_LABELS, INSPECTION_STATES } from "@/lib/bracket";
import { clockTime } from "@/lib/day-mode";
import { DeskForm, Submit, inputClass, labelClass } from "../DeskKit";
import { DeskTabs } from "../DeskTabs";
import { saveTeamDay } from "./actions";

export const metadata: Metadata = { title: "Admin | Check-in" };

/**
 * The registration desk on the day: who is here, whose robot has passed, where
 * each team is parked. Only confirmed teams are listed, since they are the ones
 * competing.
 */
export default async function CheckInDeskPage({ searchParams }: { searchParams?: { q?: string } }) {
  const admin = await requireSection("/admin/day/check-in");
  const state = await loadCompetition();
  const q = String(searchParams?.q ?? "").trim().toLowerCase();
  const teams = q ? state.competitors.filter((team) => team.name.toLowerCase().includes(q)) : state.competitors;

  const arrived = state.competitors.filter((team) => team.checkedIn).length;
  const passed = state.competitors.filter((team) => team.inspection === "PASSED").length;
  const withdrawn = state.competitors.filter((team) => team.withdrawn).length;

  return (
    <div>
      <AdminPageHeader
        title="Check-in"
        subtitle={`${arrived} of ${state.competitors.length} teams here · ${passed} passed inspection${withdrawn ? ` · ${withdrawn} withdrawn` : ""}`}
      />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day/check-in" />

      <form method="get" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Find a team
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Find a team" className={`${inputClass} mt-0 max-w-sm`} />
        <button type="submit" className="rounded-md border border-ras-gray/30 px-4 text-sm font-semibold">
          Find
        </button>
        {q ? (
          <Link href="/admin/day/check-in" className="self-center text-sm text-accent hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-4 space-y-3">
        {teams.map((team) => (
          <Card key={team.id} className={team.withdrawn ? "opacity-60" : ""}>
            <DeskForm action={saveTeamDay} className="space-y-3">
              <input type="hidden" name="registrationId" value={team.id} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-ras-purple dark:text-white">{team.name}</p>
                  <p className="text-xs text-ras-gray dark:text-white/60">
                    {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
                    {team.checkedInAt ? ` · arrived ${clockTime(team.checkedInAt)}` : ""} ·{" "}
                    <Link href={`/day/teams/${team.id}`} className="text-accent hover:underline">
                      team page
                    </Link>
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-full border border-ras-gray/25 px-3 py-1.5 text-sm font-semibold">
                  <input type="checkbox" name="checkedIn" defaultChecked={team.checkedIn} className="h-4 w-4" />
                  Checked in
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelClass} htmlFor={`${team.id}-insp`}>
                    Inspection
                  </label>
                  <select id={`${team.id}-insp`} name="inspection" defaultValue={team.inspection} className={inputClass}>
                    {INSPECTION_STATES.map((value) => (
                      <option key={value} value={value}>
                        {INSPECTION_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${team.id}-robot`}>
                    Robot name
                  </label>
                  <input id={`${team.id}-robot`} name="robotName" defaultValue={team.robotName} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${team.id}-pit`}>
                    Pit table
                  </label>
                  <input id={`${team.id}-pit`} name="pit" defaultValue={team.pit} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${team.id}-note`}>
                    Inspection note
                  </label>
                  <input id={`${team.id}-note`} name="inspectionNote" defaultValue={team.inspectionNote} className={inputClass} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/70">
                  <input type="checkbox" name="withdrawn" defaultChecked={team.withdrawn} className="h-4 w-4" />
                  Withdrawn (stays listed, cannot qualify)
                </label>
                <Submit pending="Saving…" size="sm">
                  Save
                </Submit>
              </div>
            </DeskForm>
          </Card>
        ))}
        {teams.length === 0 ? (
          <Card>
            <p className="text-sm text-ras-gray dark:text-white/70">
              {q ? "No team matches that." : "No confirmed teams yet. Confirm registrations on the Registrations screen."}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
