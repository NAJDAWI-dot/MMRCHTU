import { MAZE_GOLD, generateMaze, seededRandom } from "@/lib/maze";

/**
 * The home page's maze: a real one, carved from a fixed seed so every visitor
 * and the server draw the same walls, with a micromouse running its solution
 * over and over and leaving a trail behind it.
 *
 * The run is SMIL and the trail is CSS, both on a 5.5 second loop, so there is
 * no script on the page for it at all. With reduced motion the trail is drawn
 * whole and the mouse stays home.
 */
const RUN_S = 5.5;

export function HeroMaze({ className = "" }: { className?: string }) {
  const maze = generateMaze(10, seededRandom(2026), 0.18);
  const route = maze.routes[0]!;
  return (
    <svg viewBox={maze.viewBox} className={className} role="img" aria-label="A micromouse running a maze to the centre">
      <rect
        x={maze.goal.x + 2}
        y={maze.goal.y + 2}
        width={maze.goal.size - 4}
        height={maze.goal.size - 4}
        rx={4}
        fill={MAZE_GOLD}
        fillOpacity={0.22}
        stroke={MAZE_GOLD}
        strokeWidth={2}
      />
      <path
        d={route.solution}
        pathLength={1}
        className="day-run-path"
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: "rgb(var(--day-crimson))", ["--len" as string]: 1 }}
      />
      {maze.walls.map((d, i) => (
        <path key={i} d={d} fill="none" strokeWidth={2.6} strokeLinecap="round" style={{ stroke: "rgb(var(--day-ink))" }} />
      ))}
      <rect x={0} y={0} width={maze.size * 20} height={maze.size * 20} fill="none" strokeWidth={2.6} style={{ stroke: "rgb(var(--day-ink))" }} />
      <g className="day-run-mouse">
        <g>
          <circle r={5.2} style={{ fill: "rgb(var(--day-crimson))" }} />
          <circle cx={-3.6} cy={-3.8} r={2.6} style={{ fill: "rgb(var(--day-crimson))" }} />
          <circle cx={3.6} cy={-3.8} r={2.6} style={{ fill: "rgb(var(--day-crimson))" }} />
          <animateMotion
            path={route.solution}
            dur={`${RUN_S}s`}
            begin="0.6s"
            repeatCount="indefinite"
            keyPoints="0;1;1"
            keyTimes="0;0.7;1"
            calcMode="linear"
          />
        </g>
      </g>
    </svg>
  );
}
