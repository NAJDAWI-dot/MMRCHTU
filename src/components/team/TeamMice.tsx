import { Cheddar, type CheddarPose } from "@/components/brand/Cheddar";

/**
 * Cheddar, several times over, around the edges of the Team page.
 *
 * The committee page is the one page about people rather than about the
 * competition, and it would otherwise be the plainest thing on the site — a
 * list of names and faces. The mice are what make it feel like this site's
 * team page rather than any team page.
 *
 * Three rules keep decoration from becoming a nuisance:
 *
 * They live in the outer margins, and only appear from `xl` up where those
 * margins actually exist. Below that the content is the full width of the
 * screen and a mouse in the margin would be a mouse on top of a name.
 *
 * The whole layer is `aria-hidden` and `pointer-events-none`, so it is
 * invisible to a screen reader and cannot swallow a click meant for the page.
 *
 * And the drifting stops under `prefers-reduced-motion` — the mice stay, they
 * simply hold still. See the `team-mouse` rules in globals.css.
 *
 * Inline SVG rather than the portrait images the ambient layer uses: this is
 * six mice at once, and six image requests to decorate a page is a cost the
 * drawing does not have. It also means they take no time to arrive, so the
 * page is never briefly bare.
 */

interface Perch {
  /** How far down the page, as a percentage. */
  top: string;
  side: "left" | "right";
  /** How far out into the margin. */
  offset: string;
  size: number;
  pose: CheddarPose;
  /** Staggered so they do not bob in unison, which would read as a machine. */
  delay: string;
  /** Faces the mouse back towards the content it is peering at. */
  flip?: boolean;
}

const PERCHES: Perch[] = [
  { top: "4%", side: "left", offset: "-6.5rem", size: 92, pose: "peek", delay: "0s" },
  { top: "20%", side: "right", offset: "-7rem", size: 76, pose: "stand", delay: "1.4s", flip: true },
  { top: "38%", side: "left", offset: "-7.5rem", size: 68, pose: "run", delay: "2.6s" },
  { top: "55%", side: "right", offset: "-6.5rem", size: 88, pose: "peek", delay: "0.8s", flip: true },
  { top: "72%", side: "left", offset: "-7rem", size: 72, pose: "stand", delay: "3.2s" },
  { top: "88%", side: "right", offset: "-7.5rem", size: 80, pose: "run", delay: "2s", flip: true },
];

export function TeamMice() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden select-none xl:block"
    >
      {PERCHES.map((perch, index) => (
        <span
          key={index}
          className="team-mouse absolute"
          style={{
            top: perch.top,
            ...(perch.side === "left"
              ? { left: perch.offset }
              : { right: perch.offset }),
            animationDelay: perch.delay,
            transform: perch.flip ? "scaleX(-1)" : undefined,
          }}
        >
          <Cheddar size={perch.size} pose={perch.pose} />
        </span>
      ))}
    </div>
  );
}
