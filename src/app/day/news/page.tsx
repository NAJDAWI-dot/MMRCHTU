import type { Metadata } from "next";
import { PageHead } from "@/components/day-site/ui";
import { loadDaySite } from "@/lib/day-site";
import { postedAgo } from "@/lib/day-mode";

export const revalidate = 30;
export const metadata: Metadata = { title: "News" };

/** Every announcement from the desk, pinned first. */
export default async function DayNewsPage() {
  const site = await loadDaySite();
  return (
    <div className="space-y-10">
      <PageHead kicker="From the desk" title="Announcements" lead="Anything the organizers need you to know, as it happens." />
      {site.announcements.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {site.announcements.map((item, index) => (
            <li
              key={item.id}
              className={`day-glass day-rise p-6 ${item.isPinned ? "border-[var(--day-gold)]/50 bg-[var(--day-gold)]/[0.07] md:col-span-2" : ""}`}
              style={{ ["--i" as string]: index }}
            >
              <p className="whitespace-pre-line text-lg leading-relaxed text-white">{item.body}</p>
              <p className="mt-3 text-xs text-[var(--day-faint)]">
                {item.isPinned ? <span className="mr-2 font-semibold uppercase text-[var(--day-gold)]">Pinned</span> : null}
                {postedAgo(item.createdAt, site.now)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="day-glass p-6 text-[var(--day-muted)]">Nothing yet. This page keeps itself up to date.</p>
      )}
    </div>
  );
}
