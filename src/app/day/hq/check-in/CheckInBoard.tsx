"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { DeskForm, Submit, Toggle } from "../DeskKit";
import { quickArrive, saveTeamDay } from "./actions";

export interface CheckInMember {
  id: string;
  name: string;
  university: string;
  email: string;
  phone: string;
}

export interface CheckInTeam {
  id: string;
  name: string;
  members: CheckInMember[];
  presentIds: string[];
  checkedIn: boolean;
  /** "09:12", or empty. */
  checkedInAt: string;
  checkedInBy: string;
  badges: boolean;
  deskNote: string;
  inspection: "PENDING" | "PASSED" | "FAILED";
  inspectionNote: string;
  robotName: string;
  pit: string;
  withdrawn: boolean;
  payment: { label: string; paid: boolean; due: string };
  runOrder: number | null;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Not here yet" },
  { key: "here", label: "Checked in" },
  { key: "inspect", label: "To inspect" },
  { key: "failed", label: "Failed" },
  { key: "unpaid", label: "Unpaid" },
  { key: "withdrawn", label: "Withdrawn" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function matches(team: CheckInTeam, filter: FilterKey): boolean {
  switch (filter) {
    case "waiting":
      return !team.checkedIn && !team.withdrawn;
    case "here":
      return team.checkedIn;
    case "inspect":
      return team.checkedIn && team.inspection === "PENDING";
    case "failed":
      return team.inspection === "FAILED";
    case "unpaid":
      return !team.payment.paid;
    case "withdrawn":
      return team.withdrawn;
    default:
      return true;
  }
}

/** Everything searchable about a team, in one lower-case string. */
function haystack(team: CheckInTeam): string {
  return [
    team.name,
    team.robotName,
    team.pit,
    ...team.members.flatMap((member) => [member.name, member.email, member.phone, member.phone.replace(/\D/g, "")]),
  ]
    .join(" ")
    .toLowerCase();
}

const INSPECTION = [
  { value: "PENDING", label: "Not yet" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" },
] as const;

function ArriveButton({ team }: { team: CheckInTeam }) {
  return (
    <DeskForm action={quickArrive} className="flex items-center">
      <input type="hidden" name="registrationId" value={team.id} />
      <input type="hidden" name="arrive" value={team.checkedIn ? "0" : "1"} />
      {team.checkedIn ? (
        <Submit pending="…" variant="secondary" size="sm">
          Undo
        </Submit>
      ) : (
        <Submit pending="Checking in…" variant="good">
          <DayIcon name="check" className="h-4 w-4" />
          Check in
        </Submit>
      )}
    </DeskForm>
  );
}

function TeamRow({ team, open, onToggle }: { team: CheckInTeam; open: boolean; onToggle: () => void }) {
  const here = team.presentIds.length;
  return (
    <li className={`day-card overflow-hidden transition-shadow ${open ? "ring-2 ring-day-plum/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4 sm:p-5">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <Crest name={team.name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold text-day-ink">{team.name}</span>
            <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {team.checkedIn ? (
                <span className="rounded-full bg-day-good/10 px-2 py-0.5 text-day-good">Here {team.checkedInAt}</span>
              ) : team.withdrawn ? (
                <span className="rounded-full bg-day-live/10 px-2 py-0.5 text-day-live">Withdrawn</span>
              ) : (
                <span className="rounded-full bg-day-ink/[0.06] px-2 py-0.5 text-day-muted">Not here yet</span>
              )}
              <span className="day-num rounded-full bg-day-ink/[0.06] px-2 py-0.5 text-day-muted">
                {here}/{team.members.length} members
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ${
                  team.inspection === "PASSED" ? "bg-day-good/10 text-day-good" : team.inspection === "FAILED" ? "bg-day-live/10 text-day-live" : "bg-day-ink/[0.06] text-day-muted"
                }`}
              >
                {team.inspection === "PASSED" ? "Inspected" : team.inspection === "FAILED" ? "Failed inspection" : "To inspect"}
              </span>
              <span className={`rounded-full px-2 py-0.5 ${team.payment.paid ? "bg-day-good/10 text-day-good" : "bg-day-gold/15 text-day-gold"}`}>{team.payment.label}</span>
              {team.pit ? <span className="rounded-full bg-day-plum/10 px-2 py-0.5 text-day-plum">Pit {team.pit}</span> : null}
              {team.badges ? <span className="rounded-full bg-day-plum/10 px-2 py-0.5 text-day-plum">Badges out</span> : null}
              {team.runOrder ? <span className="day-num rounded-full bg-day-ink/[0.06] px-2 py-0.5 text-day-muted">Runs #{team.runOrder}</span> : null}
            </span>
          </span>
          <DayIcon name="more" className={`h-5 w-5 shrink-0 text-day-faint transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        {team.withdrawn ? null : <ArriveButton team={team} />}
      </div>

      {open ? (
        <DeskForm action={saveTeamDay} className="day-dialog space-y-6 border-t border-day-line/[0.07] bg-day-sunk/40 p-4 sm:p-6">
          <input type="hidden" name="registrationId" value={team.id} />

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <fieldset className="space-y-3">
              <legend className="day-kicker mb-2">Members · tick who is here</legend>
              {team.members.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-day-surface p-3 ring-1 ring-day-line/[0.07]">
                  <input
                    type="checkbox"
                    name="present"
                    value={member.id}
                    defaultChecked={team.presentIds.includes(member.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--day-good))]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-day-ink">{member.name}</span>
                    <span className="block truncate text-xs text-day-muted">{member.university}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {member.phone ? (
                        <a href={`tel:${member.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-day-plum hover:underline">
                          {member.phone}
                        </a>
                      ) : null}
                      {member.email ? (
                        <a href={`mailto:${member.email}`} className="truncate text-day-muted hover:underline">
                          {member.email}
                        </a>
                      ) : null}
                    </span>
                  </span>
                </label>
              ))}
              <div className="rounded-xl bg-day-surface p-3 text-sm ring-1 ring-day-line/[0.07]">
                <p className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-day-ink">Fee</span>
                  <span className={team.payment.paid ? "font-semibold text-day-good" : "font-semibold text-day-gold"}>
                    {team.payment.label}
                    {team.payment.due ? ` · ${team.payment.due}` : ""}
                  </span>
                </p>
                {!team.payment.paid ? <p className="mt-1 text-xs text-day-muted">Collect or check the payment before handing out badges.</p> : null}
              </div>
            </fieldset>

            <div className="space-y-4">
              <p className="day-kicker">At the desk</p>
              <Toggle
                name="checkedIn"
                defaultChecked={team.checkedIn}
                label="Checked in"
                hint={team.checkedIn ? `At ${team.checkedInAt}${team.checkedInBy ? ` by ${team.checkedInBy}` : ""}` : "Turn on when the team arrives"}
              />
              <Toggle name="badges" defaultChecked={team.badges} label="Badges and kit handed out" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="day-label" htmlFor={`robot-${team.id}`}>
                    Robot name
                  </label>
                  <input id={`robot-${team.id}`} name="robotName" defaultValue={team.robotName} className="day-input" />
                </div>
                <div>
                  <label className="day-label" htmlFor={`pit-${team.id}`}>
                    Pit table
                  </label>
                  <input id={`pit-${team.id}`} name="pit" defaultValue={team.pit} className="day-input" placeholder="e.g. B4" />
                </div>
              </div>
              <div>
                <span className="day-label">Robot inspection</span>
                <div className="day-segment">
                  {INSPECTION.map((option) => (
                    <label key={option.value}>
                      <input type="radio" name="inspection" value={option.value} defaultChecked={team.inspection === option.value} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="day-label" htmlFor={`inote-${team.id}`}>
                  Inspection note
                </label>
                <input id={`inote-${team.id}`} name="inspectionNote" defaultValue={team.inspectionNote} className="day-input" placeholder="e.g. 26 cm wide, asked to trim the bumper" />
              </div>
              <div>
                <label className="day-label" htmlFor={`note-${team.id}`}>
                  Desk note (staff only)
                </label>
                <textarea id={`note-${team.id}`} name="deskNote" defaultValue={team.deskNote} rows={2} className="day-input" />
              </div>
              <Toggle name="withdrawn" defaultChecked={team.withdrawn} label="Withdrawn" hint="Takes the team out of qualifying." />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Submit pending="Saving…">Save {team.name}</Submit>
            <button type="button" onClick={onToggle} className="day-btn day-btn-soft">
              Close
            </button>
          </div>
        </DeskForm>
      ) : null}
    </li>
  );
}

/** The registration desk on the day: find a team fast, check it in in one tap. */
export function CheckInBoard({ teams }: { teams: CheckInTeam[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to the search box, as it does on most admin tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const indexed = useMemo(() => teams.map((team) => ({ team, text: haystack(team) })), [teams]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item.key, teams.filter((team) => matches(team, item.key)).length])), [teams]);
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ team, text }) => matches(team, filter) && words.every((word) => text.includes(word)))
      .map(({ team }) => team);
  }, [indexed, query, filter]);

  return (
    <div className="space-y-5">
      <div className="day-card space-y-3 p-3 sm:p-4">
        <label className="relative block">
          <span className="sr-only">Find a team</span>
          <DayIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-day-faint" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && shown.length === 1) setOpenId(shown[0]!.id);
            }}
            placeholder="Team, member, email, phone, robot or pit.  Press / to search"
            className="day-input h-14 rounded-2xl pl-12 text-lg"
            autoComplete="off"
          />
        </label>
        <div className="day-no-scrollbar -mx-1 overflow-x-auto px-1">
          <div role="group" aria-label="Filter teams" className="day-segment flex-nowrap">
            {FILTERS.map((item) => (
              <label key={item.key}>
                <input type="radio" name="checkin-filter" checked={filter === item.key} onChange={() => setFilter(item.key)} />
                <span className="whitespace-nowrap">
                  {item.label}
                  <span className="day-num text-xs opacity-60">{counts[item.key]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-day-muted" aria-live="polite">
        {shown.length} of {teams.length} teams{shown.length === 1 && query ? ". Press Enter to open it." : ""}
      </p>

      <ul className="space-y-3">
        {shown.map((team) => (
          <TeamRow key={team.id} team={team} open={openId === team.id} onToggle={() => setOpenId((id) => (id === team.id ? null : team.id))} />
        ))}
      </ul>
      {shown.length === 0 ? <p className="day-card p-6 text-day-muted">No team matches that.</p> : null}
    </div>
  );
}
