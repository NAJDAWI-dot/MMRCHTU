"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { JourneyBadge } from "@/components/day-site/ui";
import type { Journey } from "@/lib/bracket";

export interface TeamCardData {
  id: string;
  name: string;
  journey: Journey;
  rank: number | null;
  best: string;
  seed: number | null;
  checkedIn: boolean;
  robotName: string;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in", label: "Still in" },
  { key: "qualified", label: "Qualified" },
  { key: "out", label: "Out" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function matches(team: TeamCardData, filter: FilterKey): boolean {
  const state = team.journey.state;
  if (filter === "all") return true;
  if (filter === "in") return !["NOT_QUALIFIED", "ELIMINATED", "RUNNER_UP"].includes(state);
  if (filter === "qualified") return team.seed !== null;
  return ["NOT_QUALIFIED", "ELIMINATED"].includes(state);
}

/** Every team as a card, with a search box and quick filters. */
export function TeamGrid({ teams }: { teams: TeamCardData[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((team) => matches(team, filter) && (!q || team.name.toLowerCase().includes(q)));
  }, [teams, query, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="team-search" className="sr-only">
          Find a team
        </label>
        <input
          id="team-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a team"
          className="w-full max-w-sm rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-white placeholder:text-white/40 focus:border-[var(--day-gold)] focus:outline-none"
        />
        <div role="group" aria-label="Filter teams" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === item.key ? "bg-white text-[#1a0b1f]" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-[var(--day-faint)]" aria-live="polite">
          {shown.length} of {teams.length}
        </p>
      </div>

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((team) => (
          <li key={team.id}>
            <Link href={`/day/teams/${team.id}`} className="day-card day-glass flex h-full items-center gap-4 p-4">
              <Crest name={team.name} size={44} glow={team.journey.state === "CHAMPION"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-extrabold text-white">{team.name}</span>
                <span className="mt-1 block">
                  <JourneyBadge journey={team.journey} />
                </span>
                <span className="mt-2 flex gap-3 font-mono text-xs text-[var(--day-faint)]">
                  {team.seed ? <span>Seed {team.seed}</span> : team.rank ? <span>#{team.rank}</span> : null}
                  {team.best !== "–" ? <span>Best {team.best}</span> : null}
                  {team.checkedIn ? <span className="text-[var(--day-mint)]">Here</span> : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="text-[var(--day-muted)]">No team matches that.</p> : null}
    </div>
  );
}
