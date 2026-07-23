import type { Metadata } from "next";
import { CheddarMouseGame } from "@/game";

export const metadata: Metadata = {
  title: "Cheddar Mouse",
  description: "Play Cheddar Mouse, the MMRC 26 maze game.",
};

export default function GamePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-center font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Cheddar Mouse
      </h1>
      <div className="mt-8">
        <CheddarMouseGame />
      </div>
    </div>
  );
}
