import { MICE, TOP_MOUSE_TURN } from "@/components/day-site/DayMice";
import { CELL, MAZE_GOLD, generateMaze, seededRandom } from "@/lib/maze";

/**
 * The home page's maze: a real ten by ten one, the size MMRC 26 runs on,
 * carved from a fixed seed so every visitor and the server draw the same
 * walls. Drawn like the real thing: square walls, a post at every point where
 * walls can meet, the gold centre, and Cheddar, seen from above, running its
 * solution over and over and leaving his crimson route behind him.
 *
 * The run is SMIL and the trail is CSS, both on a 5.5 second loop, so there is
 * no script on the page for it at all. With reduced motion the trail is drawn
 * whole and the mouse stays home. It takes its inks from the theme, so on the
 * maze floor the walls are light.
 */
const RUN_S = 5.5;
const SIZE = 10;
const POST = 4.2;
/** Cheddar, nose to tail, in maze units: a little under a cell, like a real micromouse. */
const MOUSE = 17;

export function HeroMaze({ className = "" }: { className?: string }) {
  const maze = generateMaze(SIZE, seededRandom(2026), 0.18);
  const route = maze.routes[0]!;
  const span = SIZE * CELL;
  const mouseH = (MOUSE * MICE.top.height) / MICE.top.width;
  let posts = "";
  for (let row = 0; row <= SIZE; row++) {
    for (let col = 0; col <= SIZE; col++) {
      posts += `M${col * CELL - POST / 2} ${row * CELL - POST / 2}h${POST}v${POST}h-${POST}z`;
    }
  }
  return (
    <svg viewBox={`-4 -4 ${span + 8} ${span + 8}`} className={className} role="img" aria-label="A micromouse running a ten by ten maze to the centre">
      <rect
        x={maze.goal.x + 2}
        y={maze.goal.y + 2}
        width={maze.goal.size - 4}
        height={maze.goal.size - 4}
        fill={MAZE_GOLD}
        fillOpacity={0.24}
        stroke={MAZE_GOLD}
        strokeWidth={1.4}
      />
      <path
        d={route.solution}
        pathLength={1}
        className="day-run-path"
        fill="none"
        strokeWidth={4.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
        style={{ stroke: "rgb(var(--day-crimson))", ["--len" as string]: 1 }}
      />
      <g fill="none" strokeWidth={2.4} strokeLinecap="square" style={{ stroke: "rgb(var(--day-ink) / 0.9)" }}>
        {maze.walls.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <rect x={0} y={0} width={span} height={span} />
      </g>
      <path d={posts} style={{ fill: "rgb(var(--day-ink))" }} />
      <g className="day-run-mouse">
        <g opacity={0}>
          {/* Out of sight until the run starts, rather than parked on a corner post. */}
          <set attributeName="opacity" to="1" begin="0.6s" fill="freeze" />
          {/* Cheddar from above, turned so his nose leads along the route. */}
          <image
            href={MICE.top.src}
            width={MOUSE}
            height={mouseH}
            x={-MOUSE / 2}
            y={-mouseH / 2}
            transform={`rotate(${TOP_MOUSE_TURN})`}
            preserveAspectRatio="xMidYMid meet"
          />
          <animateMotion
            path={route.solution}
            dur={`${RUN_S}s`}
            begin="0.6s"
            repeatCount="indefinite"
            keyPoints="0;1;1"
            keyTimes="0;0.7;1"
            calcMode="linear"
            rotate="auto"
          />
        </g>
      </g>
    </svg>
  );
}
