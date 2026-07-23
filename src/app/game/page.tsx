import type { Metadata } from "next";
import { GameTabs } from "@/game/classic/GameTabs";

export const metadata: Metadata = {
  title: "Robo-Maze Mouse",
  description: "Play Robo-Maze Mouse in Classic or First-Person mode.",
};

export default function GamePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-center font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Robo-Maze Mouse
      </h1>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-ras-gray dark:text-white/70">
        Guide the lab mouse through the circuit maze, collect solder dots, and dodge the patrol robots &mdash; in
        classic top-down or first-person view.
      </p>
      <div className="mt-8">
        <GameTabs />
      </div>
    </div>
  );
}
