import Link from "next/link";
import { Crest } from "@/components/day-site/Crest";
import type { QueueEntry } from "@/lib/run-queue";

export interface QueueCardsProps {
  /** The teams on the mazes now, one per maze. */
  now: QueueEntry[];
  /** The next call's teams, and the call after. */
  onDeck: QueueEntry[];
  inHole: QueueEntry[];
  calledAt: string;
  onDeckEta: string;
  inHoleEta: string;
  /** The maze a team runs on, "" when there is only one. */
  mazeOf: (entry: QueueEntry) => string;
  /** Called in the last minute and a half: the card lights once and says so. */
  justCalled?: boolean;
}

function Code({ code, big = false }: { code?: string; big?: boolean }) {
  if (!code) return null;
  return <span className={`day-num mr-2 inline-block bg-day-ink px-1.5 align-middle font-extrabold text-day-on-ink ${big ? "text-lg sm:text-2xl" : "text-xs"}`}>{code}</span>;
}

/**
 * The qualifying call queue on the live page: the teams on the mazes large,
 * the next two calls beside them. With two mazes side by side each call is two
 * teams, one per maze. Each links to the team's page, where a team further
 * back sees how many calls go before its own.
 */
export function QueueCards({ now, onDeck, inHole, calledAt, onDeckEta, inHoleEta, mazeOf, justCalled = false }: QueueCardsProps) {
  const lead = now.length ? now : onDeck;
  const several = lead.length > 1;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className={`${now.length ? "day-floor" : "day-card"} day-posts relative overflow-hidden p-6 sm:p-8 ${now.length && justCalled ? "day-called" : ""}`} data-reveal>
        <p className={`flex items-center gap-2 text-sm font-semibold ${now.length ? "text-day-live" : "text-day-muted"}`}>
          {now.length ? <span className="day-live-dot" aria-hidden="true" /> : null}
          {now.length ? (justCalled ? `Just called to the maze${several ? "s" : ""}` : `On the maze${several ? "s" : ""}`) : "First up"}
          {now.length && calledAt ? <span className="day-num font-medium text-day-muted">· called at {calledAt}</span> : null}
          {!now.length && onDeckEta ? <span className="day-num font-medium text-day-muted">· {onDeckEta}</span> : null}
        </p>
        <ul className={`mt-5 grid gap-5 ${several ? "sm:grid-cols-2" : ""}`}>
          {lead.map((entry) => (
            <li key={entry.id} className="min-w-0">
              <Link href={`/day/teams/${entry.id}`} data-team={entry.id} className="group flex items-center gap-4">
                <Crest name={entry.name} size={several ? 48 : 64} ring={!!now.length} />
                <span className="min-w-0">
                  <span
                    className={`day-display line-clamp-2 block break-words leading-tight text-day-ink group-hover:underline ${several ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}
                  >
                    <Code code={entry.code} big={!several} />
                    {entry.name}
                  </span>
                  <span className="day-num mt-2 block text-day-muted">
                    Runs #{entry.runOrder}
                    {mazeOf(entry) ? <span className="font-semibold text-day-crimson"> · {mazeOf(entry)}</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {(now.length
          ? [
              { label: "On deck", group: onDeck, eta: onDeckEta, tone: "text-day-gold" },
              { label: "In the hole", group: inHole, eta: inHoleEta, tone: "text-day-plum" },
            ]
          : [{ label: "Then", group: inHole, eta: inHoleEta, tone: "text-day-plum" }]
        ).map((slot, index) => (
          <li key={slot.label} className="day-card day-posts p-5 sm:p-6" data-reveal style={{ ["--i" as string]: index + 1 }}>
            <p className={`text-sm font-semibold ${slot.tone}`}>
              {slot.label}
              {slot.eta ? <span className="day-num font-medium text-day-muted"> · {slot.eta}</span> : null}
            </p>
            {slot.group.length ? (
              <ul className="mt-3 space-y-3">
                {slot.group.map((entry) => (
                  <li key={entry.id}>
                    <Link href={`/day/teams/${entry.id}`} data-team={entry.id} className="group flex items-center gap-3">
                      <Crest name={entry.name} size={32} />
                      <span className="min-w-0">
                        <span className="day-display line-clamp-2 block break-words text-2xl leading-tight text-day-ink group-hover:underline">
                          <Code code={entry.code} />
                          {entry.name}
                        </span>
                        <span className="day-num block text-sm text-day-muted">
                          #{entry.runOrder}
                          {mazeOf(entry) ? ` · ${mazeOf(entry)}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-day-muted">Nobody left after this.</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
