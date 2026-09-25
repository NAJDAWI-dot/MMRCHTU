"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const KEY = "mmrc-day-ranks";

/** Before paint in the browser, so a moved row never flashes at its new place first. */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Ranks = Record<string, number>;

function readSaved(): Ranks | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Ranks) : null;
  } catch {
    return null;
  }
}

function save(ranks: Ranks) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ranks));
  } catch {
    // Storage blocked: the changes still show while the page is open.
  }
}

/**
 * The timing tower's memory. Each row carries data-team and data-rank; this
 * notes the places you last saw (in this browser, across visits) and, when
 * they change, marks each row that moved (▲2, ▼1, New) and slides it from
 * where it was to where it is now. The page is right without it: the marks
 * and the slide are extra, and reduced motion keeps the marks and drops the
 * slide.
 */
export function TowerMotion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<Ranks | null>(null);
  const tops = useRef<Map<string, number>>(new Map());

  useBeforePaint(() => {
    const root = ref.current;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-team][data-rank]"));
    const now: Ranks = {};
    for (const row of rows) {
      const rank = Number(row.dataset.rank);
      if (rank > 0) now[row.dataset.team!] = rank;
    }
    const before = shown.current ?? readSaved();
    const changed = !before || Object.keys(now).length !== Object.keys(before).length || Object.entries(now).some(([id, rank]) => before[id] !== rank);

    if (before && changed) {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (const row of rows) {
        const id = row.dataset.team!;
        const mark = row.querySelector<HTMLElement>(".day-delta");
        const was = before[id];
        const is = now[id];
        if (mark) {
          if (is && was && was !== is) {
            mark.dataset.delta = `${was > is ? "▲" : "▼"}${Math.abs(was - is)}`;
            mark.dataset.dir = was > is ? "up" : "down";
            mark.title = `Was ${was}${was === 1 ? "st" : was === 2 ? "nd" : was === 3 ? "rd" : "th"} when you last looked`;
          } else if (is && !was && Object.keys(before).length) {
            mark.dataset.delta = "New";
            mark.dataset.dir = "new";
            mark.title = "New in the table since you last looked";
          } else {
            delete mark.dataset.delta;
            delete mark.dataset.dir;
          }
        }
        // Slide from the old place to the new one, when the page was already showing it.
        const top = row.offsetTop;
        const old = tops.current.get(id);
        if (!still && shown.current && old !== undefined && old !== top) {
          row.animate([{ transform: `translate3d(0, ${old - top}px, 0)` }, { transform: "none" }], {
            duration: 900,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          });
          row.classList.remove("day-flash");
          void row.offsetWidth;
          row.classList.add("day-flash");
        }
      }
    }
    if (changed) save(now);
    shown.current = now;
    tops.current = new Map(rows.map((row) => [row.dataset.team!, row.offsetTop]));
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
