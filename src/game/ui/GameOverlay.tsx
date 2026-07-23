import type { GamePhase } from "@/game/engine/types";
import { Button } from "@/components/ui/Button";

interface GameOverlayProps {
  phase: GamePhase;
  score: number;
  onStart: () => void;
  onRestart: () => void;
}

export function GameOverlay({ phase, score, onStart, onRestart }: GameOverlayProps) {
  if (phase === "ready" || phase === "playing" || phase === "life-lost") {
    return null;
  }

  const content = OVERLAY_CONTENT[phase];
  if (!content) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center text-white">
      <h2 className="font-display text-2xl font-bold">{content.title}</h2>
      {phase !== "paused" ? <p className="font-mono text-sm">Score: {score}</p> : null}
      <Button onClick={phase === "paused" ? onStart : onRestart} autoFocus>
        {content.action}
      </Button>
    </div>
  );
}

const OVERLAY_CONTENT: Partial<Record<GamePhase, { title: string; action: string }>> = {
  paused: { title: "Paused", action: "Resume" },
  "game-over": { title: "Game over", action: "Play again" },
  victory: { title: "You cleared every maze!", action: "Play again" },
  "level-complete": { title: "Level complete!", action: "Continue" },
};
