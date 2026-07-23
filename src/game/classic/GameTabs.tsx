"use client";

import { useState } from "react";
import { ClassicMaze } from "./ClassicMaze";
import { FirstPerson } from "./FirstPerson";

type Tab = "classic" | "fp";

const TABS: { id: Tab; label: string }[] = [
  { id: "classic", label: "🕹️ Classic Maze" },
  { id: "fp", label: "👁️ First-Person" },
];

export function GameTabs() {
  const [tab, setTab] = useState<Tab>("classic");

  return (
    <div>
      <nav aria-label="Game mode" className="mb-6 flex justify-center gap-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              tab === t.id
                ? "border-[#F2A900] bg-ras-purple text-white"
                : "border-ras-purple/40 bg-transparent text-ras-gray hover:text-ras-purple dark:text-white/70 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div
        key={tab}
        className="motion-safe:animate-[fadeIn_.32s_cubic-bezier(.22,.61,.36,1)]"
      >
        {tab === "classic" ? <ClassicMaze /> : <FirstPerson />}
      </div>
    </div>
  );
}
