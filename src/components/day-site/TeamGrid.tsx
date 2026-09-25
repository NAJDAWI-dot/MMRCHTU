"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { JourneyBadge } from "@/components/day-site/ui";
import type { Journey } from "@/lib/bracket";

export interface TeamCardData {
  id: string;
  name: string;
  journey: Journey;
  rank: number | null;
  /** Already formatted: "160.0", or "–". */
  score: string;
  runs: number;
  /** Already formatted: "25.0 s", or "–". */
  best: string;
  seed: number | null;
  checkedIn: boolean;
  robotName: string;
  members: number;
  university: string;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in", label: "Still in" },
  { key: "qualified", label: "Qualified" },
  { key: "here", label: "Checked in" },
  { key: "out", label: "Out" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "name", label: "A to Z" },
  { key: "rank", label: "By rank" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function matches(team: TeamCardData, filter: FilterKey): boolean {
  const state = team.journey.state;
  if (filter === "all") return true;
  if (filter === "in") return !["NOT_QUALIFIED", "ELIMINATED", "RUNNER_UP"].includes(state);
  if (filter === "qualified") return team.seed !== null;
  if (filter === "here") return team.checkedIn;
  return ["NOT_QUALIFIED", "ELIMINATED"].includes(state);
}

/**
 * A team's plate: its maze crest, its name run wide, what it is and where it
 * stands, and its numbers. A crest greys out once the team is out.
 */
function TeamCard({ team }: { team: TeamCardData }) {
  const out = ["NOT_QUALIFIED", "ELIMINATED"].includes(team.journey.state);
  const corner = team.seed ? `Seed ${team.seed}` : team.rank ? `#${team.rank}` : null;
  return (
    <Link
      href={`/day/teams/${team.id}`}
      data-team={team.id}
      className={`day-card day-lift day-posts group flex h-full flex-col ${team.journey.state === "CHAMPION" ? "border-day-gold" : ""}`}
    >
      <div className="flex flex-1 items-center gap-4 p-4">
        <span className={`transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-3 ${out ? "opacity-55 grayscale" : ""}`}>
          <Crest name={team.name} size={40} ring={team.journey.state === "CHAMPION"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="day-display block truncate text-[1.3rem] leading-tight text-day-ink underline-offset-4 group-hover:underline" title={team.name}>
            {team.name}
          </span>
          <span className="mt-1 block truncate text-[0.8125rem] text-day-muted">
            {[team.robotName ? `Robot ${team.robotName}` : null, team.university || null, `${team.members} member${team.members === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {corner ? <span className="day-num shrink-0 self-start text-[0.8125rem] font-bold text-day-muted">{corner}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-day-line/[0.1] px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <JourneyBadge journey={team.journey} />
          {team.checkedIn ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-day-good">
              <span className="h-1.5 w-1.5 bg-day-good" aria-hidden="true" />
              Here
            </span>
          ) : null}
        </span>
        <span className="day-num shrink-0 text-sm text-day-muted">
          <span className="font-bold text-day-ink">{team.score}</span>
          {team.runs ? ` · ${team.runs} run${team.runs === 1 ? "" : "s"} · ${team.best}` : ""}
        </span>
      </div>
    </Link>
  );
}

/** Every team as a card, with a search box, quick filters and a sort. */
export function TeamGrid({ teams }: { teams: TeamCardData[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((item) => [item.key, teams.filter((team) => matches(team, item.key)).length])),
    [teams],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = teams.filter(
      (team) =>
        matches(team, filter) &&
        (!q || team.name.toLowerCase().includes(q) || team.robotName.toLowerCase().includes(q) || team.university.toLowerCase().includes(q)),
    );
    if (sort === "rank") {
      list.sort((a, b) => (a.seed ?? a.rank ?? 999) - (b.seed ?? b.rank ?? 999) || a.name.localeCompare(b.name));
    }
    return list;
  }, [teams, query, filter, sort]);

  return (
    <div className="space-y-8">
      <div className="sticky top-[66px] z-30 -mx-4 flex flex-col gap-3 border-b border-day-line/[0.12] bg-day-bg px-4 py-3 sm:-mx-6 sm:px-6 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Find a team</span>
          <DayIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-day-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Team, robot or university"
            className="day-input h-12 pl-12"
          />
        </label>
        <div className="day-no-scrollbar -mx-1 overflow-x-auto px-1">
          <div role="group" aria-label="Filter teams" className="day-segment flex-nowrap">
            {FILTERS.map((item) => (
              <label key={item.key}>
                <input type="radio" name="team-filter" checked={filter === item.key} onChange={() => setFilter(item.key)} />
                <span className="whitespace-nowrap">
                  {item.label}
                  <span className="day-num text-xs opacity-60">{counts[item.key]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div role="group" aria-label="Sort teams" className="day-segment shrink-0">
          {SORTS.map((item) => (
            <label key={item.key}>
              <input type="radio" name="team-sort" checked={sort === item.key} onChange={() => setSort(item.key)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="text-sm text-day-muted" aria-live="polite">
        Showing {shown.length} of {teams.length}
      </p>

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((team, index) => (
          <li key={team.id} data-reveal style={{ ["--i" as string]: index % 6 }}>
            <TeamCard team={team} />
          </li>
        ))}
      </ul>
      {shown.length === 0 && teams.length ? <p className="text-day-muted">No team matches that.</p> : null}
    </div>
  );
}
