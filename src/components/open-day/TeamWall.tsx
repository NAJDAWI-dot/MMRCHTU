import Link from "next/link";
import { crestFor } from "@/lib/crest";
import { CrestMaze } from "@/components/brand/CrestMaze";
import { teamCountLabel, wallSummary } from "@/lib/open-day";

export interface WallTeam {
  id: string;
  name: string;
}

/**
 * Every team registered so far, as the mazes their names make.
 *
 * At a stand, "forty teams have entered" is a sentence nobody believes and
 * nobody remembers. Forty different mazes with forty names under them is the
 * same fact as a picture, and it happens to be a picture only this competition
 * can make, since the crest generator is already how a team gets its mark.
 *
 * A team name and nothing else. The university each leader studies at was here
 * at first, and it is not the wall's to publish: a team chooses its name, and
 * did not choose to have where its members study read off a screen in a hall.
 *
 * Rendered on the server, with no JavaScript: crests are a pure function of a
 * team name, so a hundred of them are a hundred bits of markup rather than a
 * hundred components waiting to hydrate on a phone in a hall.
 */
export function TeamWall({ teams, total }: { teams: WallTeam[]; total: number }) {
  const summary = wallSummary(total);

  if (teams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ras-gray/30 p-6 text-center text-sm text-ras-gray dark:border-white/20 dark:text-white/70">
        No teams on the wall yet.{" "}
        <Link href="/register" className="font-semibold text-accent underline underline-offset-2">
          Register
        </Link>{" "}
        and yours is the first one on it.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ras-purple dark:text-white">
        {teamCountLabel(summary.total)}
      </p>

      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {teams.map((team) => {
          const crest = crestFor(team.name);
          return (
            <li
              key={team.id}
              className="flex flex-col items-center rounded-xl border border-ras-purple/15 bg-[var(--color-surface)] p-2 text-center dark:border-white/10"
            >
              <div className="flex h-[58px] w-[58px] items-center justify-center">
                {crest ? (
                  <CrestMaze maze={crest} size={54} label={null} strokeWidth={3.4} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-[46px] w-[46px] rounded border border-dashed border-ras-gray/30 dark:border-white/20"
                  />
                )}
              </div>
              <span className="mt-1 w-full truncate text-[11px] font-semibold leading-tight text-ras-purple dark:text-white">
                {team.name}
              </span>
            </li>
          );
        })}
      </ul>

      {summary.overflow > 0 && (
        <p className="mt-3 text-xs text-ras-gray dark:text-white/55">
          And {summary.overflow} more, not drawn here so the page stays quick on a phone.
        </p>
      )}
    </div>
  );
}
