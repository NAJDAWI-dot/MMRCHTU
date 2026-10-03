import { groupByTier, type LogoBackground } from "@/lib/sponsors";
import { SponsorLogo } from "./SponsorLogo";

export interface WallSponsor {
  id: string;
  name: string;
  tier: string;
  logoUrl: string;
  logoBackground: LogoBackground;
}

/**
 * The sponsors' logos for a projector slide, grouped by tier, sized in vh so
 * they fill the hall screen and the testing day screen alike. Fewer sponsors,
 * bigger logos; with tiers, the first tier leads.
 */
export function SponsorWall({ sponsors }: { sponsors: WallSponsor[] }) {
  const groups = groupByTier(sponsors);
  const size = (count: number) => (count <= 3 ? "h-[26vh] w-[40vh]" : count <= 8 ? "h-[19vh] w-[30vh]" : "h-[13vh] w-[21vh]");
  const tileFor = (index: number, count: number) => (groups.length === 1 ? size(count) : index === 0 ? size(Math.max(count, 4)) : size(Math.max(count, 9)));
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[3.5vh] overflow-hidden">
      {groups.map((group, index) => (
        <div key={group.tier || "untiered"} role="group" aria-label={group.tier || "Sponsors"}>
          {group.tier ? <p className="day-kicker mb-[1.8vh] text-center text-[2vh]">{group.tier}</p> : null}
          <ul className="flex flex-wrap justify-center gap-[2.5vh]">
            {group.sponsors.map((sponsor) => (
              <li key={sponsor.id}>
                <SponsorLogo
                  name={sponsor.name}
                  logoUrl={sponsor.logoUrl}
                  background={sponsor.logoBackground}
                  className={`${tileFor(index, group.sponsors.length)} p-[2.4vh]`}
                  nameClass="text-[3.4vh]"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
