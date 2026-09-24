import Link from "next/link";
import { Crest } from "@/components/day-site/Crest";
import type { QueueEntry } from "@/lib/run-queue";

export interface QueueCardsProps {
  now: QueueEntry | null;
  onDeck: QueueEntry | null;
  inHole: QueueEntry | null;
  calledAt: string;
  onDeckEta: string;
  inHoleEta: string;
}

/**
 * The qualifying call queue on the live page: the team on the maze large, the
 * two after it beside it. Each links to the team's page, where a team further
 * back sees how many go before it.
 */
export function QueueCards({ now, onDeck, inHole, calledAt, onDeckEta, inHoleEta }: QueueCardsProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="day-card relative overflow-hidden p-6 sm:p-8" data-reveal>
        {now ? <div className="day-stripe-x absolute inset-x-0 top-0 h-1.5" aria-hidden="true" /> : null}
        <p className={`flex items-center gap-2 text-sm font-semibold ${now ? "text-day-live" : "text-day-muted"}`}>
          {now ? <span className="day-live-dot" aria-hidden="true" /> : null}
          {now ? "On the maze" : "First up"}
        </p>
        {now || onDeck ? (
          <Link href={`/day/teams/${(now ?? onDeck)!.id}`} data-team={(now ?? onDeck)!.id} className="group mt-5 flex items-center gap-4">
            <Crest name={(now ?? onDeck)!.name} size={64} />
            <span className="min-w-0">
              <span className="day-display line-clamp-2 block break-words text-3xl leading-tight text-day-ink group-hover:underline sm:text-5xl">
                {(now ?? onDeck)!.name}
              </span>
              <span className="day-num mt-2 block text-day-muted">
                Runs #{(now ?? onDeck)!.runOrder}
                {now && calledAt ? ` · called at ${calledAt}` : !now && onDeckEta ? ` · ${onDeckEta}` : ""}
              </span>
            </span>
          </Link>
        ) : null}
      </div>
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {(now
          ? [
              { label: "On deck", entry: onDeck, eta: onDeckEta, tone: "text-day-gold" },
              { label: "In the hole", entry: inHole, eta: inHoleEta, tone: "text-day-plum" },
            ]
          : [{ label: "Then", entry: inHole, eta: inHoleEta, tone: "text-day-plum" }]
        ).map((slot, index) => (
          <li key={slot.label} className="day-card p-5 sm:p-6" data-reveal style={{ ["--i" as string]: index + 1 }}>
            <p className={`text-sm font-semibold ${slot.tone}`}>{slot.label}</p>
            {slot.entry ? (
              <Link href={`/day/teams/${slot.entry.id}`} data-team={slot.entry.id} className="group mt-3 flex items-center gap-3">
                <Crest name={slot.entry.name} size={32} />
                <span className="min-w-0">
                  <span className="day-display line-clamp-2 block break-words text-2xl leading-tight text-day-ink group-hover:underline">
                    {slot.entry.name}
                  </span>
                  <span className="day-num block text-sm text-day-muted">
                    #{slot.entry.runOrder}
                    {slot.eta ? ` · ${slot.eta}` : ""}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-day-muted">Nobody left after this.</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
