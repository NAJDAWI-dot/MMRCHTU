import type { GameState } from "@/game/engine/types";

interface HUDProps {
  state: Pick<GameState, "score" | "highScore" | "level" | "mouse">;
}

export function HUD({ state }: HUDProps) {
  return (
    <div className="flex items-center justify-between px-1 py-2 font-mono text-sm text-[var(--color-fg)]">
      <span>SCORE {state.score.toString().padStart(6, "0")}</span>
      <span>HIGH {state.highScore.toString().padStart(6, "0")}</span>
      <span>LEVEL {state.level}</span>
      <span aria-hidden="true">
        {"🐭".repeat(Math.max(0, state.mouse.lives))}
        {state.mouse.lives === 0 ? "—" : ""}
      </span>
    </div>
  );
}

/** Visually-hidden live region announcing state changes for screen readers. */
export function GameLiveRegion({ state }: HUDProps) {
  return (
    <p className="sr-only-live" aria-live="polite">
      Score {state.score}. Lives {state.mouse.lives}. Level {state.level}.
    </p>
  );
}
