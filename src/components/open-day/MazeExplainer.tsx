"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAZE_GOLD, type Maze } from "@/lib/maze";
import { RULES, cellCentre, compareRuns, pathData, searchWalk, startCell } from "@/lib/rules";
import { GoalBlock, MazeCanvas } from "@/components/rules/MazeCanvas";
import {
  EXPLAINER_LENGTH_MS,
  explainerFrameAt,
  explainerShowsSpeedRun,
  teachingMaze,
  type ExplainerPhase,
} from "@/lib/open-day";

/**
 * What a micromouse is, in twenty seconds, with the sound off.
 *
 * Written for a stand in a hall: whoever is watching has a phone in one hand,
 * no headphones, and no idea what the word means. So the argument is carried
 * by the drawing and by four captions, and it is the same argument the rules
 * page makes with `RunComparison` — the first run is slow because the mouse has
 * never seen the maze, the second is fast because now it has. Showing only the
 * fast run would make the whole thing look like line following.
 *
 * The runs are not staged. Both come from the competition's own generator and
 * from the same functions the rulebook diagrams use, so the numbers in the
 * captions are what this maze actually costs rather than figures picked to look
 * good.
 *
 * The timing lives in `@/lib/open-day` and is tested there. Everything here is
 * presentation, and the moving parts are written straight to the DOM rather
 * than through state: a rAF loop re-rendering React sixty times a second to
 * move one circle would be the most expensive thing on the page.
 */

interface Counts {
  searchMoves: number;
  speedMoves: number;
}

const CAPTIONS: Record<ExplainerPhase, { title: string; body: (counts: Counts) => string }> = {
  search: {
    title: "Run 1. It has never seen this maze",
    body: () =>
      "No map, no remote control, nobody touching it. The mouse feels its way along the walls, hits dead ends and backs out of them. Every cell it touches is a cell it remembers.",
  },
  learned: {
    title: "Now it has a map",
    body: (counts) => `That cost ${counts.searchMoves} moves. The mouse kept every one of them.`,
  },
  speed: {
    title: "Run 2. Straight to the middle",
    body: (counts) =>
      `Same maze, same robot, ${counts.speedMoves} moves. The only thing that changed is that it knows the way.`,
  },
  pitch: {
    title: "That is micromouse",
    body: (counts) =>
      `${counts.searchMoves} moves to learn it, ${counts.speedMoves} to run it. Build the robot that does that on its own, and bring it to MMRC26.`,
  },
};

export function MazeExplainer() {
  const [maze, setMaze] = useState<Maze | null>(null);
  const [phase, setPhase] = useState<ExplainerPhase>("search");
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  const walkRef = useRef<SVGPathElement>(null);
  const speedRef = useRef<SVGPathElement>(null);
  const mouseRef = useRef<SVGGElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const originRef = useRef(0);

  // Generated on the client, on mount, like every other maze on the site. One
  // produced during render would differ between the server's markup and the
  // browser's, which is a hydration error.
  const roll = useCallback(() => {
    setMaze(teachingMaze());
    setPhase("search");
  }, []);

  useEffect(roll, [roll]);

  const figure = useMemo(() => {
    if (!maze) return null;
    const runs = compareRuns(maze);
    return {
      walkPath: pathData(searchWalk(maze)),
      speedPath: pathData(runs.speed),
      start: cellCentre(startCell(maze)),
      counts: {
        searchMoves: runs.search.moves,
        // Both paths are lists of cells, and a path of n cells is n-1 moves.
        speedMoves: Math.max(0, runs.speed.length - 1),
      } satisfies Counts,
    };
  }, [maze]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  /*
    Starts itself the first time it is actually on screen, and only then.

    Playing from mount would mean the run somebody scrolls down to is already
    half over, and would spend a rAF loop on something nobody is looking at.
    Anyone who has asked for reduced motion gets the finished picture and a
    button instead of a loop they did not ask for.
  */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || reduced || startedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        startedRef.current = true;
        originRef.current = performance.now();
        setPlaying(true);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [reduced]);

  /** Both lines complete and the mouse parked on the goal: the resting state. */
  const settle = useCallback(() => {
    const draw = (el: SVGPathElement | null) => {
      if (!el) return;
      el.style.strokeDasharray = "none";
      el.style.strokeDashoffset = "0";
    };
    draw(walkRef.current);
    draw(speedRef.current);
    if (walkRef.current) walkRef.current.style.strokeOpacity = "0.25";

    const speed = speedRef.current;
    if (speed && mouseRef.current) {
      const end = speed.getPointAtLength(speed.getTotalLength());
      mouseRef.current.setAttribute("transform", `translate(${end.x} ${end.y})`);
    }
    if (barRef.current) barRef.current.style.transform = "scaleX(1)";
  }, []);

  useEffect(() => {
    if (!figure) return;

    if (!playing) {
      settle();
      setPhase("pitch");
      return;
    }

    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      const { phase: current, progress, overall } = explainerFrameAt(now - originRef.current);
      setPhase((was) => (was === current ? was : current));

      const walk = walkRef.current;
      const speed = speedRef.current;
      const mouse = mouseRef.current;
      if (!walk || !speed || !mouse) return;

      const showsSpeed = explainerShowsSpeedRun(current);
      const walkFraction = current === "search" ? progress : 1;
      const speedFraction = current === "speed" ? progress : showsSpeed ? 1 : 0;

      const walkLength = walk.getTotalLength();
      walk.style.strokeDasharray = `${walkLength}`;
      walk.style.strokeDashoffset = `${walkLength * (1 - walkFraction)}`;
      // The exploring line stays on screen once the speed run starts, faded.
      // Clearing it would throw away the comparison the figure is making.
      walk.style.strokeOpacity = showsSpeed ? "0.25" : "0.9";

      const speedLength = speed.getTotalLength();
      speed.style.strokeDasharray = `${speedLength}`;
      speed.style.strokeDashoffset = `${speedLength * (1 - speedFraction)}`;

      const carrying = showsSpeed ? speed : walk;
      const fraction = showsSpeed ? speedFraction : walkFraction;
      const point = carrying.getPointAtLength(carrying.getTotalLength() * fraction);
      mouse.setAttribute("transform", `translate(${point.x} ${point.y})`);

      if (barRef.current) barRef.current.style.transform = `scaleX(${overall})`;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [figure, playing, settle]);

  const counts = figure?.counts ?? { searchMoves: 0, speedMoves: 0 };
  const caption = CAPTIONS[phase];

  return (
    <div
      ref={hostRef}
      className="rounded-2xl border border-ras-purple/20 bg-[var(--color-surface)] p-4 dark:border-white/15 sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2 sm:items-center">
        <div className="mx-auto w-full max-w-[420px]">
          {maze && figure ? (
            <MazeCanvas
              maze={maze}
              label="A micromouse maze solved twice: once by exploring, once at speed."
            >
              <GoalBlock maze={maze} className="fill-[#f2a900]/15 stroke-[#f2a900]" />
              <circle
                cx={figure.start.x}
                cy={figure.start.y}
                r={3}
                className="fill-ras-gray/60 dark:fill-white/50"
              />
              <path
                ref={walkRef}
                d={figure.walkPath}
                fill="none"
                stroke={MAZE_GOLD}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                ref={speedRef}
                d={figure.speedPath}
                fill="none"
                className="stroke-ras-crimson dark:stroke-[#ff7b7b]"
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g ref={mouseRef}>
                <circle r={4.6} fill={MAZE_GOLD} />
                <circle r={2} className="fill-ras-purple dark:fill-[#1b1622]" />
              </g>
            </MazeCanvas>
          ) : (
            <div className="aspect-square w-full rounded-xl border border-dashed border-ras-gray/30 dark:border-white/20" />
          )}

          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ras-gray/15 dark:bg-white/15">
            <div ref={barRef} className="h-full origin-left scale-x-0 bg-[#f2a900]" />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-ras-crimson dark:text-[#ff9b9b]">
            Twenty seconds, no sound needed
          </p>

          {/* Fixed height, so four captions of different lengths do not push the
              maze up and down the screen as they swap. */}
          <div aria-hidden="true" className="mt-2 min-h-[150px] sm:min-h-[160px]">
            <h3 className="font-display text-xl font-extrabold text-ras-purple dark:text-white">
              {caption.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ras-gray dark:text-white/75">
              {caption.body(counts)}
            </p>
          </div>

          {/* The captions change four times a run, which is no use to a screen
              reader. This says the whole thing once and then stays put. */}
          <p className="sr-only">
            An animation of a micromouse solving a maze. On its first run it explores, taking{" "}
            {counts.searchMoves} moves and backing out of dead ends. On its second run it drives the
            route it learned and reaches the centre in {counts.speedMoves} moves.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                originRef.current = performance.now();
                startedRef.current = true;
                setPhase("search");
                setPlaying(true);
              }}
              className="min-h-[44px] rounded-full bg-ras-purple px-5 text-sm font-semibold text-white transition-transform active:scale-95"
            >
              {playing ? "Start again" : "Play it"}
            </button>
            <button
              type="button"
              onClick={() => {
                originRef.current = performance.now();
                roll();
              }}
              className="min-h-[44px] rounded-full border border-ras-purple/40 px-5 text-sm font-semibold text-ras-purple transition-transform active:scale-95 dark:border-white/30 dark:text-white"
            >
              Different maze
            </button>
          </div>

          <p className="mt-3 text-xs text-ras-gray dark:text-white/55">
            {RULES.mazeGrid} by {RULES.mazeGrid} cells, the size of the maze at the competition.
            Runs for {Math.round(EXPLAINER_LENGTH_MS / 1000)} seconds, then starts over.
          </p>
        </div>
      </div>
    </div>
  );
}
