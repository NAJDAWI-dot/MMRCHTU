"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import type { FollowCard } from "@/lib/follow";

/**
 * Following a team: one team per browser, kept in this browser only. The team
 * is lit up wherever it appears on the day site (anything carrying
 * data-team="<id>"), and a card with where it stands and what is next stays
 * in the corner.
 */

const KEY = "mmrc-follow";
const EVENT = "mmrc-follow";

function readFollow(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setFollow(id: string) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: following still works until the page is left.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

export function useFollow(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    setId(readFollow());
    const onChange = (event: Event) => setId((event as CustomEvent<string>).detail ?? readFollow());
    const onStorage = (event: StorageEvent) => event.key === KEY && setId(event.newValue ?? "");
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return id;
}

/** "Follow" on a team's page. */
export function FollowButton({ id, name }: { id: string; name: string }) {
  const followed = useFollow() === id;
  return (
    <button
      type="button"
      onClick={() => setFollow(followed ? "" : id)}
      aria-pressed={followed}
      className={`day-btn day-btn-sm ${followed ? "border-day-gold bg-day-gold text-day-on-ink hover:bg-day-gold/90" : "day-btn-soft"}`}
      title={followed ? `Stop following ${name}` : `Follow ${name} across the day site`}
    >
      <DayIcon name="star" className="h-4 w-4" />
      {followed ? "Following" : "Follow this team"}
    </button>
  );
}

/** A picker for the team to follow, for the live and teams pages. */
export function FollowPicker({ teams }: { teams: { id: string; name: string }[] }) {
  const id = useFollow();
  return (
    <label className="flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-day-line/[0.12] py-4" data-reveal>
      <DayIcon name="star" className={`h-5 w-5 shrink-0 ${id ? "text-day-gold" : "text-day-muted"}`} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-day-ink">{id ? "Following" : "Follow a team"}</span>
        <span className="block text-[0.8125rem] text-day-muted">It lights up in gold everywhere on the day site, with what is next for it in the corner.</span>
      </span>
      <select value={id} onChange={(event) => setFollow(event.target.value)} className="day-input h-11 w-full sm:w-64" aria-label="The team to follow">
        <option value="">Nobody</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const TONE: Record<FollowCard["tone"], string> = {
  live: "text-day-live",
  gold: "text-day-gold",
  good: "text-day-good",
  ink: "text-day-ink",
  muted: "text-day-muted",
};

/** The corner card, and the light on the followed team wherever it appears. */
export function FollowDock({ cards }: { cards: FollowCard[] }) {
  const id = useFollow();
  const [open, setOpen] = useState(true);
  const card = cards.find((item) => item.id === id);
  const [seen, setSeen] = useState("");
  // On a phone the card would cover the page, so it opens to say hello, or when
  // something changes, and folds itself away again after a few seconds.
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(window.matchMedia("(max-width: 1023px)").matches), []);
  useEffect(() => {
    if (id) setOpen(true);
  }, [id]);
  // A change in what is next (called on deck, into the next round) pops the card open.
  useEffect(() => {
    if (!card) return;
    if (seen && seen !== card.next) setOpen(true);
    setSeen(card.next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.next]);
  useEffect(() => {
    if (!phone || !open) return;
    const timer = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(timer);
  }, [phone, open, card?.next]);
  if (!card || !/^[\w-]+$/.test(card.id)) return null;

  return (
    <>
      <style>{`[data-team="${card.id}"]{background-color:rgb(var(--day-gold)/0.1)!important;outline:2px solid rgb(var(--day-gold)/0.7);outline-offset:-2px}[data-cell-team="${card.id}"]{outline:2px solid rgb(var(--day-gold));outline-offset:2px}`}</style>
      <aside
        className="day-follow fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] lg:bottom-6 lg:right-6"
        aria-label={`Following ${card.name}`}
      >
        {open ? (
          <div className={`day-card day-posts shadow-[var(--day-shadow-lift)] ${card.live ? "border-day-live/50" : "border-day-gold/50"}`}>
            <div className="flex items-center gap-3 p-4">
              <Crest name={card.name} size={30} ring={card.tone === "gold"} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-day-gold">
                  <DayIcon name="star" className="h-3 w-3" />
                  Following
                </p>
                <Link href={`/day/teams/${card.id}`} className="block truncate font-bold text-day-ink hover:underline">
                  {card.name}
                </Link>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fold the card away" className="grid h-10 w-10 place-items-center rounded-[6px] text-day-muted hover:bg-day-ink/[0.06]">
                <DayIcon name="more" className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="border-t border-day-line/[0.1] bg-day-sunk px-4 py-3" aria-live="polite">
              <p className="text-xs font-semibold text-day-muted">{card.status}</p>
              <p className={`mt-0.5 flex items-center gap-2 text-sm font-semibold ${TONE[card.tone]}`}>
                {card.live ? <span className="day-live-dot" aria-hidden="true" /> : null}
                {card.next}
              </p>
              <div className="mt-3 flex gap-2">
                <Link href={`/day/teams/${card.id}`} className="day-btn day-btn-soft day-btn-sm">
                  Team page
                </Link>
                <button type="button" onClick={() => setFollow("")} className="day-btn day-btn-soft day-btn-sm">
                  Stop following
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`day-card ml-auto flex min-h-[2.75rem] items-center gap-2 py-1.5 pl-1.5 pr-3.5 shadow-[var(--day-shadow-lift)] ${card.live ? "border-day-live/50" : "border-day-gold/50"}`}
            aria-label={`${card.name}: ${card.next}. Open the card`}
          >
            <Crest name={card.name} size={22} />
            <span className="max-w-[12rem] truncate text-sm font-semibold text-day-ink">{card.name}</span>
            {card.live ? <span className="day-live-dot" aria-hidden="true" /> : <DayIcon name="star" className="h-3.5 w-3.5 text-day-gold" />}
          </button>
        )}
      </aside>
    </>
  );
}
