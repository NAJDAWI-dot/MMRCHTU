import type { Metadata } from "next";
import { Empty, PageHead } from "@/components/day-site/ui";
import { loadDaySite } from "@/lib/day-site";
import { clockTime, postedAgo } from "@/lib/day-mode";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 30;
export const metadata: Metadata = { title: "News" };

const TONE: Record<string, { label: string; className: string }> = {
  URGENT: { label: "Urgent", className: "bg-day-live/10 text-day-live" },
  GOOD: { label: "Good news", className: "bg-day-good/10 text-day-good" },
};

/** Every announcement from the desk, pinned first, as a feed. */
export default async function DayNewsPage() {
  await requireDayViewer();
  const site = await loadDaySite();
  return (
    <div className="space-y-12">
      <PageHead kicker="From the desk" title="News" lead="Anything the organisers need you to know, as it happens. This page keeps itself up to date." />
      {site.announcements.length ? (
        <ol className="relative mx-auto max-w-3xl space-y-4 border-l-2 border-day-line/10 pl-6 sm:pl-10">
          {site.announcements.map((item, index) => (
            <li key={item.id} className="relative" data-reveal style={{ ["--i" as string]: index % 6 }}>
              <span
                aria-hidden="true"
                className={`absolute -left-[33px] top-6 h-4 w-4 rounded-full border-4 border-day-bg sm:-left-[49px] ${
                  item.isPinned ? "bg-day-gold" : item.tone === "URGENT" ? "bg-day-live" : "bg-day-plum"
                }`}
              />
              <article className={`day-card p-6 ${item.isPinned ? "ring-1 ring-day-gold/50" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-day-faint">
                  {item.isPinned ? <span className="rounded-full bg-day-gold/15 px-2 py-0.5 text-day-gold">Pinned</span> : null}
                  {TONE[item.tone] ? <span className={`rounded-full px-2 py-0.5 ${TONE[item.tone]!.className}`}>{TONE[item.tone]!.label}</span> : null}
                  <span className="day-num">{clockTime(item.createdAt)}</span>
                  <span>· {postedAgo(item.createdAt, site.now)}</span>
                </p>
                {item.title ? <h2 className="day-display mt-3 text-2xl text-day-ink">{item.title}</h2> : null}
                <p className={`whitespace-pre-line leading-relaxed ${item.title ? "mt-2 text-day-muted" : "mt-3 text-lg text-day-ink"}`}>{item.body}</p>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <Empty icon="megaphone" title="Nothing from the desk yet">
          Announcements appear here, and urgent ones pop up wherever you are on the site.
        </Empty>
      )}
    </div>
  );
}
