"use client";

import Link from "next/link";
import { useMemo, useState, type PointerEvent } from "react";
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

/** The header's tint says where the team stands before a word is read. */
const HEADER_TINT: Record<Journey["state"], string> = {
  REGISTERED: "from-day-ink/[0.05] to-day-ink/[0.02]",
  QUALIFYING: "from-day-plum/20 to-day-plum/[0.04]",
  NOT_QUALIFIED: "from-day-ink/[0.06] to-transparent",
  QUALIFIED: "from-day-good/20 to-day-good/[0.04]",
  ALIVE: "from-day-good/20 to-day-good/[0.04]",
  ELIMINATED: "from-day-ink/[0.06] to-transparent",
  RUNNER_UP: "from-day-plum/25 to-day-plum/[0.05]",
  CHAMPION: "from-day-gold/35 to-day-gold/[0.06]",
};

/** Tilts the card towards the pointer, a few degrees, like a card in the hand. */
function tilt(event: PointerEvent<HTMLAnchorElement>) {
  if (event.pointerType !== "mouse") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width - 0.5;
  const y = (event.clientY - box.top) / box.height - 0.5;
  card.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
  card.style.setProperty("--shine-x", `${((x + 0.5) * 100).toFixed(1)}%`);
  card.style.setProperty("--shine-y", `${((y + 0.5) * 100).toFixed(1)}%`);
}

function untilt(event: PointerEvent<HTMLAnchorElement>) {
  event.currentTarget.style.transform = "";
}

function TeamCard({ team }: { team: TeamCardData }) {
  const out = ["NOT_QUALIFIED", "ELIMINATED"].includes(team.journey.state);
  const corner = team.seed ? `Seed ${team.seed}` : team.rank ? `#${team.rank}` : null;
  return (
    <Link
      href={`/day/teams/${team.id}`}
      data-team={team.id}
      onPointerMove={tilt}
      onPointerLeave={untilt}
      className={`day-card group relative flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[var(--day-shadow-lift)] ${
        team.journey.state === "CHAMPION" ? "ring-2 ring-day-gold/60" : ""
      }`}
    >
      {/* The header: crest large, on a tint and a faint grid. */}
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${HEADER_TINT[team.journey.state]}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--day-line) / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--day-line) / 0.07) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
        <span className={`relative transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-3 group-hover:scale-[1.06] ${out ? "opacity-60 grayscale" : ""}`}>
          <Crest name={team.name} size={64} ring={team.journey.state === "CHAMPION"} />
        </span>
        {corner ? (
          <span className="day-num absolute left-4 top-4 rounded-full bg-day-surface/90 px-2.5 py-1 text-xs font-bold text-day-ink shadow-sm">
            {corner}
          </span>
        ) : null}
        {team.checkedIn ? (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-day-surface/90 px-2.5 py-1 text-xs font-semibold text-day-good shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-day-good" aria-hidden="true" />
            Here
          </span>
        ) : null}
        {/* A soft light that follows the pointer across the card. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(22rem circle at var(--shine-x, 50%) var(--shine-y, 0%), rgb(255 255 255 / 0.18), transparent 45%)" }}
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="day-display truncate text-2xl text-day-ink" title={team.name}>
          {team.name}
        </p>
        <p className="mt-1 truncate text-sm text-day-muted">
          {[team.robotName ? `Robot ${team.robotName}` : null, team.university || null, `${team.members} member${team.members === 1 ? "" : "s"}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-4">
          <JourneyBadge journey={team.journey} />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-day-line/[0.07] pt-4">
          <div>
            <dt className="text-[11px] font-semibold text-day-faint">Score</dt>
            <dd className="day-num day-display mt-1 text-xl text-day-ink">{team.score}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-day-faint">Runs</dt>
            <dd className="day-num day-display mt-1 text-xl text-day-ink">{team.runs || "–"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-day-faint">Best time</dt>
            <dd className="day-num day-display mt-1 text-xl text-day-ink">{team.best}</dd>
          </div>
        </dl>
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
      <div className="day-card flex flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Find a team</span>
          <DayIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-day-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Team, robot or university"
            className="day-input h-12 rounded-full pl-12"
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

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((team, index) => (
          <li key={team.id} data-reveal style={{ ["--i" as string]: index % 8 }}>
            <TeamCard team={team} />
          </li>
        ))}
      </ul>
      {shown.length === 0 && teams.length ? <p className="text-day-muted">No team matches that.</p> : null}
    </div>
  );
}
