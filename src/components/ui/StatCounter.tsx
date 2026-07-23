"use client";

import { useEffect, useState } from "react";

interface StatCounterProps {
  statKey: string;
  label: string;
  /** Poll interval in ms; set 0 to fetch once. */
  pollIntervalMs?: number;
}

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; value: number };

export function StatCounter({ statKey, label, pollIntervalMs = 30_000 }: StatCounterProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as Record<string, number>;
        if (!cancelled) setState({ status: "ready", value: data[statKey] ?? 0 });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    load();
    if (pollIntervalMs > 0) {
      const id = setInterval(load, pollIntervalMs);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [statKey, pollIntervalMs]);

  return (
    <div className="text-center">
      <div
        className="font-display text-4xl font-bold text-ras-purple dark:text-white"
        aria-live="polite"
      >
        {state.status === "ready" ? state.value : state.status === "error" ? "—" : "…"}
      </div>
      <div className="mt-1 text-sm text-ras-gray dark:text-white/70">{label}</div>
    </div>
  );
}
