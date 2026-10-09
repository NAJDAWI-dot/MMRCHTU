import { generateMaze, seededRandom } from "@/lib/maze";

/**
 * The background once the competition is over, the same in both themes.
 *
 * The light theme's artwork is cream and the dark theme's is plum; this sits
 * between them, a dusk in mauve and rose with a gold glow low on the right,
 * so neither theme owns it. Pages float above it on a frosted sheet that
 * follows the theme (see .wrap-sheet), which is what keeps every page
 * readable on a background that is neither light nor dark.
 *
 * Over the colour: a faint maze across the whole screen, two mice drawing
 * their routes through it in gold, slowly and on a loop, and a little grain.
 * Static markup rendered on the server; the motion is CSS and stops under
 * reduced motion.
 */
export function WrapUpBackdrop() {
  // One maze, the same for every visitor.
  const maze = generateMaze(16, seededRandom(2610));
  const routes = maze.routes.slice(0, 2);

  return (
    <div className="wrap-backdrop" aria-hidden="true">
      <div className="wrap-backdrop-glow wrap-backdrop-glow-a" />
      <div className="wrap-backdrop-glow wrap-backdrop-glow-b" />
      <svg className="wrap-backdrop-maze" viewBox={maze.viewBox} preserveAspectRatio="xMidYMid slice">
        <g fill="none" strokeLinecap="round" stroke="rgba(255,255,255,0.11)" strokeWidth={1.1}>
          {maze.walls.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {routes.map((route, i) => (
          <path
            key={i}
            d={route.solution}
            pathLength={1}
            className={`wrap-backdrop-trail wrap-backdrop-trail-${i + 1}`}
            fill="none"
            stroke="#f2c14e"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <rect
          x={maze.goal.x + 1}
          y={maze.goal.y + 1}
          width={maze.goal.size - 2}
          height={maze.goal.size - 2}
          rx={2}
          fill="#f2a900"
          fillOpacity={0.16}
          stroke="#f2a900"
          strokeOpacity={0.35}
        />
      </svg>
      <svg className="wrap-backdrop-grain" width="100%" height="100%">
        <filter id="wrap-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#wrap-grain)" />
      </svg>
    </div>
  );
}
