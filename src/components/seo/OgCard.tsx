import { MAZE_GOLD, generateMaze, seededRandom } from "@/lib/maze";
import { DIAGRAM_BRAID, RULES } from "@/lib/rules";

/**
 * The share card every page is previewed as.
 *
 * There was one card for the whole site, so a link to the rules and a link to
 * the registration form arrived in a group chat looking identical — the reader
 * could not tell from the preview which one had been sent. Each page now names
 * itself, against the same background, so the family is obvious and the
 * individual card still says something.
 *
 * Written for `next/og`, which is Satori underneath, not a browser: every
 * element that holds more than one child needs an explicit `display: flex`,
 * there is no cascade, and only inline styles apply.
 *
 * Every route that uses this must declare `runtime = "edge"`. Under the Node
 * runtime @vercel/og resolves its bundled default font through `fileURLToPath`,
 * which throws `TypeError: Invalid URL` during `next build` and fails the whole
 * export; the edge build loads the same font differently and does not. Nothing
 * here needs a Node API — the maze generator is pure — so the edge runtime
 * costs nothing. It does mean no route using this card may read the database.
 */

/** 1200x630 is what every crawler crops to; anything else gets letterboxed. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/*
  The maze is seeded rather than random: each card is generated once and cached
  at the edge, so randomness would not produce variety — it would make the one
  card that does get built unreproducible, and a bad draw would be stuck there
  until the next deploy. A different seed per page is what makes them differ.
*/

export interface OgCardProps {
  /** The small gold line above the title. */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** A quieter line under the subtitle — a date, a fee, a call to action. */
  footnote?: string;
  /** Chooses the maze. Any integer; different pages should differ. */
  seed: number;
}

/**
 * Title sizing is computed, not fixed.
 *
 * Satori does not wrap-and-shrink the way a browser does, and a long page name
 * at the size "MMRC 26" wants would run off the edge of the card — which is
 * invisible until someone shares that page. Three steps, chosen so the longest
 * title the site actually has still sits on one or two comfortable lines.
 */
function titleSize(title: string): number {
  if (title.length <= 8) return 128;
  if (title.length <= 18) return 92;
  return 68;
}

export function OgCard({ eyebrow, title, subtitle, footnote, seed }: OgCardProps) {
  // Braided, like the diagrams on the rules page: a perfect carve reads as long
  // empty corridors at this scale, where a few loops read as a maze.
  const maze = generateMaze(RULES.mazeGrid, seededRandom(seed), DIAGRAM_BRAID);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: "linear-gradient(135deg, #2a0e2f 0%, #5F2167 55%, #862633 140%)",
        color: "#ffffff",
        padding: 64,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: MAZE_GOLD,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: titleSize(title),
            fontWeight: 800,
            lineHeight: 1.05,
            marginTop: 12,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 36, marginTop: 16, color: "rgba(255,255,255,0.88)" }}>
            {subtitle}
          </div>
        ) : null}
        {footnote ? (
          <div style={{ fontSize: 26, marginTop: 28, color: "rgba(255,255,255,0.65)" }}>
            {footnote}
          </div>
        ) : null}
      </div>

      {/* The maze is drawn from the generator the competition itself uses,
          rather than being a drawn asset — the picture is the actual thing,
          and it stays in step for free if the generator ever changes. */}
      <svg width={420} height={420} viewBox={maze.viewBox} style={{ marginLeft: 48 }}>
        <rect
          x={0}
          y={0}
          width={maze.size * 20}
          height={maze.size * 20}
          fill="rgba(0,0,0,0.22)"
          rx={12}
        />
        <rect
          x={maze.goal.x}
          y={maze.goal.y}
          width={maze.goal.size}
          height={maze.goal.size}
          fill={MAZE_GOLD}
          opacity={0.85}
        />
        {maze.walls.map((d, i) => (
          <path key={i} d={d} stroke="rgba(255,255,255,0.82)" strokeWidth={2.4} fill="none" />
        ))}
        <path
          d={maze.routes[0]!.solution}
          stroke={MAZE_GOLD}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
