"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayMouse } from "@/components/day-site/DayMice";
import type { RevealShow } from "@/lib/reveal-show";

const PLAYED = "mmrc-screen-reveals";
const COUNT_MS = 1000;
const STEP_MS = 1400;

/** Whether this screen has played this reveal already. */
export function playedBefore(id: string): boolean {
  try {
    return (JSON.parse(window.localStorage.getItem(PLAYED) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}

function markPlayed(id: string) {
  try {
    const played = (JSON.parse(window.localStorage.getItem(PLAYED) ?? "[]") as string[]).filter((item) => item !== id).slice(-20);
    window.localStorage.setItem(PLAYED, JSON.stringify([...played, id]));
  } catch {
    // Storage blocked: it may play again after a reload, which is harmless.
  }
}

function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.4,
        duration: 3.2 + Math.random() * 2.8,
        drift: `${(Math.random() - 0.5) * 30}vw`,
        spin: `${360 + Math.random() * 900}deg`,
        color: ["rgb(var(--day-gold))", "rgb(var(--day-crimson))", "rgb(255 248 240)", "rgb(255 214 120)"][index % 4],
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {pieces.map((piece, index) => (
        <i
          key={index}
          className="reveal-confetti"
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ["--drift" as string]: piece.drift,
            ["--spin" as string]: piece.spin,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The reveal, full screen over the hall screen: a countdown, the title, then
 * the results arriving one by one, the best last. Plays once per screen per
 * reveal; any key or click skips it.
 */
export function RevealTakeover({ show, onDone }: { show: RevealShow; onDone: () => void }) {
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const start = useMemo(() => Date.now(), []);
  const [now, setNow] = useState(start);
  const [leaving, setLeaving] = useState(false);

  const countdown = reduced ? 0 : 3 * COUNT_MS;
  const rowCount = show.rows.length;
  const revealAll = show.mode === "ranking" ? countdown + 1200 + rowCount * STEP_MS : countdown + 1200 + rowCount * 90;
  const hold = show.mode === "champion" ? 22_000 : 14_000;
  const total = (reduced ? 0 : revealAll) + hold;

  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => markPlayed(show.id), [show.id]);

  // The clock that drives it all, until it starts to leave.
  useEffect(() => {
    if (leaving) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [leaving]);

  useEffect(() => {
    if (!leaving && now - start >= total) setLeaving(true);
  }, [now, start, total, leaving]);

  // Leaving: the fade, then gone. On its own so nothing restarts the wait.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => done.current(), 900);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    const skip = () => setLeaving(true);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  const elapsed = now - start;
  const counting = !reduced && elapsed < countdown;
  const number = 3 - Math.floor(elapsed / COUNT_MS);
  const afterTitle = elapsed - countdown - 1200;
  // Ranking: from the bottom up. Names: a quick cascade.
  const shownRows = reduced
    ? rowCount
    : show.mode === "ranking"
      ? Math.max(0, Math.min(rowCount, Math.floor(afterTitle / STEP_MS) + 1))
      : Math.max(0, Math.min(rowCount, Math.floor(afterTitle / 90) + 1));
  const firstIn = show.mode === "ranking" && shownRows === rowCount && rowCount > 0;

  return (
    <div className={`reveal-stage ${leaving ? "is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label={`${show.kicker}: ${show.title}`}>
      {show.mode === "champion" && !counting ? <div className="reveal-rays" aria-hidden="true" /> : null}

      <div className="relative flex h-full flex-col items-center justify-center px-[6vh] text-center">
        {counting ? (
          <div className="flex flex-col items-center gap-[7vh]">
            <p className="day-kicker text-[2.4vh] text-[rgb(var(--day-gold))]">{show.kicker}</p>
            <p key={number} className="reveal-count day-num day-display text-[30vh] leading-none">
              {number}
            </p>
          </div>
        ) : show.mode === "champion" && show.champion ? (
          <div className="flex flex-col items-center gap-[3vh]">
            <p className="reveal-title day-kicker text-[2.8vh] text-[rgb(var(--day-gold))]">{show.kicker}</p>
            <div className="reveal-row" style={{ animationDelay: "300ms" }}>
              <Crest name={show.champion.name} size={220} ring />
            </div>
            <p className="reveal-title text-[3.4vh] font-semibold opacity-80" style={{ animationDelay: "500ms" }}>
              {show.title}
            </p>
            <h2 className="reveal-title reveal-shine day-display text-[13vh] leading-[0.95]" style={{ animationDelay: "800ms" }}>
              {show.champion.name}
            </h2>
            <p className="reveal-row text-[3vh] opacity-75" style={{ animationDelay: "1400ms" }}>
              {show.champion.detail}
            </p>
            <div className="reveal-burst pointer-events-none absolute left-1/2 top-[42%] h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--day-gold)/0.6),transparent_65%)]" aria-hidden="true" />
            {reduced ? null : <Confetti count={140} />}
            {/* Cheddar dancing for them, down in both corners of the screen. */}
            <div className="reveal-row absolute bottom-[3vh] left-[4vw] w-[26vh]" style={{ animationDelay: "1600ms" }}>
              <DayMouse name="dance" move="hop" />
            </div>
            <div className="reveal-row absolute bottom-[3vh] right-[4vw] w-[26vh]" style={{ animationDelay: "1750ms" }}>
              <DayMouse name="dance" move="hop" flip />
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-[150vh] flex-col items-center gap-[3.5vh]">
            <div>
              <p className="reveal-title day-kicker text-[2.4vh] text-[rgb(var(--day-gold))]">{show.kicker}</p>
              <h2 className="reveal-title day-display mt-[1vh] text-[9vh] leading-none" style={{ animationDelay: "150ms" }}>
                {show.title}
              </h2>
            </div>
            {show.mode === "ranking" ? (
              // First place across the top, the rest in two columns under it; they
              // arrive from the last place up, and first place last of all.
              <div className="w-full space-y-[1.6vh]" aria-live="polite">
                {show.rows[0] ? (
                  <div
                    className={`flex items-center gap-[3vh] rounded-[0.5vh] border-2 border-[rgb(var(--day-gold)/0.7)] px-[4vh] py-[2vh] ${firstIn ? "reveal-row" : "invisible"}`}
                    style={{ background: "linear-gradient(100deg, rgb(var(--day-gold) / 0.22), rgb(var(--day-gold) / 0.06))" }}
                  >
                    <span className="reveal-shine day-num day-display w-[9vh] text-left text-[9vh] leading-none">1</span>
                    <Crest name={show.rows[0].name} size={84} ring />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[6vh] font-bold leading-tight">{show.rows[0].name}</span>
                      {show.rows[0].detail ? <span className="block truncate text-[2.2vh] opacity-70">{show.rows[0].detail}</span> : null}
                    </span>
                    <span className="reveal-shine day-num day-display text-[9vh] leading-none">{show.rows[0].value}</span>
                  </div>
                ) : null}
                <ol className="grid w-full grid-cols-2 gap-[1.2vh]">
                  {show.rows.slice(1).map((row, offset) => {
                    const index = offset + 1;
                    const visible = index >= rowCount - shownRows;
                    return (
                      <li
                        key={row.name + index}
                        className={`flex items-center gap-[2.4vh] rounded-[0.4vh] px-[2.6vh] py-[1.1vh] ${visible ? "reveal-row" : "invisible"}`}
                        style={{ background: "rgb(255 255 255 / 0.06)" }}
                      >
                        <span className="day-num day-display w-[5vh] text-left text-[3.6vh] opacity-60">{index + 1}</span>
                        <Crest name={row.name} size={40} />
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[3vh] font-semibold">{row.name}</span>
                          {row.detail ? <span className="block truncate text-[1.7vh] opacity-60">{row.detail}</span> : null}
                        </span>
                        <span className="day-num day-display text-[3.8vh]">{row.value}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <ol className="grid w-full grid-cols-4 gap-[1.2vh]" aria-live="polite">
                {show.rows.map((row, index) => (
                  <li
                    key={row.name + index}
                    className={`flex items-center gap-[1.4vh] rounded-[0.4vh] px-[1.8vh] py-[1.2vh] text-left ${index < shownRows ? "reveal-row" : "invisible"}`}
                    style={{ background: "rgb(255 255 255 / 0.06)" }}
                  >
                    <Crest name={row.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[2.5vh] font-semibold">{row.name}</span>
                      {row.value ? <span className="block text-[1.6vh] opacity-60">{row.value}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {firstIn && !reduced ? (
              <>
                <div className="reveal-burst pointer-events-none absolute left-1/2 top-[40%] h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--day-gold)/0.45),transparent_65%)]" aria-hidden="true" />
                <Confetti />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
