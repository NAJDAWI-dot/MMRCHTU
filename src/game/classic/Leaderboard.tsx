"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GAME_MODE_LABELS,
  GAME_OVER_EVENT,
  MAX_NAME_LENGTH,
  sanitisePlayerName,
  type GameMode,
  type GameOverDetail,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

const NAME_MEMORY_KEY = "pacMousePlayerName";

/**
 * Top scores for one game mode, plus the "enter your name" form that appears
 * after a run ends.
 *
 * The canvas games are imperative and own their own state, so they announce the
 * end of a run by dispatching a `pacmouse:gameover` CustomEvent on window
 * rather than being rewired to lift score into React.
 */
export function Leaderboard({ mode }: { mode: GameMode }) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<GameOverDetail | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/scores?mode=${mode}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load scores.");
      const data = (await res.json()) as { scores: LeaderboardEntry[] };
      setScores(data.scores);
    } catch {
      // A leaderboard that can't load must not break the game around it — the
      // empty-state copy below covers this case.
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setName(localStorage.getItem(NAME_MEMORY_KEY) ?? "");
  }, []);

  useEffect(() => {
    function onGameOver(event: Event) {
      const detail = (event as CustomEvent<GameOverDetail>).detail;
      if (!detail || detail.mode !== mode) return;
      setPending(detail);
      setMessage(null);
    }
    window.addEventListener(GAME_OVER_EVENT, onGameOver);
    return () => window.removeEventListener(GAME_OVER_EVENT, onGameOver);
  }, [mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;

    const playerName = sanitisePlayerName(name);
    if (!playerName) {
      setMessage("Enter a name to save your score.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/game/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, score: pending.score, level: pending.level, mode }),
      });
      const data = (await res.json()) as { rank?: number; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not save your score.");
        return;
      }
      localStorage.setItem(NAME_MEMORY_KEY, playerName);
      setMessage(`Saved — you're #${data.rank} on the ${GAME_MODE_LABELS[mode]} board.`);
      setPending(null);
      await load();
    } catch {
      setMessage("Could not reach the server. Your score wasn't saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label={`${GAME_MODE_LABELS[mode]} leaderboard`}
      data-testid="leaderboard"
      className="mx-auto mt-8 w-full max-w-[700px] rounded-lg border border-ras-purple/30 bg-[var(--color-surface)] p-5"
    >
      <h2 className="font-display text-lg font-bold uppercase tracking-widest text-ras-purple dark:text-white">
        {GAME_MODE_LABELS[mode]} leaderboard
      </h2>

      {pending && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-md bg-ras-purple/10 p-4 dark:bg-white/10">
          <p className="text-sm text-ras-gray dark:text-white/80">
            Run over with <b className="text-[#F2A900]">{pending.score}</b> points on level {pending.level}. Save it to
            the board:
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor={`player-name-${mode}`} className="sr-only">
              Your name
            </label>
            <input
              id={`player-name-${mode}`}
              data-testid="player-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Your name"
              autoComplete="nickname"
              className="min-w-0 flex-1 rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"
            />
            <button
              type="submit"
              data-testid="save-score"
              disabled={submitting}
              className="rounded-md bg-ras-crimson px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mood-garnet disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save score"}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-ras-purple/40 px-3 py-2 text-sm text-ras-purple dark:border-white/30 dark:text-white"
            >
              Skip
            </button>
          </div>
        </form>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-ras-purple dark:text-white">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-ras-gray dark:text-white/60">Loading scores…</p>
      ) : scores.length === 0 ? (
        <p className="mt-4 text-sm text-ras-gray dark:text-white/60">
          No scores yet — play a round and be the first on the board.
        </p>
      ) : (
        <ol className="mt-4 space-y-1">
          {scores.map((entry, index) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-3 border-b border-ras-gray/10 py-1.5 font-mono text-sm last:border-0"
            >
              <span className="w-8 shrink-0 text-ras-gray dark:text-white/50">#{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-ras-gray dark:text-white/85">{entry.playerName}</span>
              <span className="shrink-0 text-xs text-ras-gray/70 dark:text-white/45">lvl {entry.level}</span>
              <span className="w-16 shrink-0 text-right font-bold text-[#F2A900]">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
