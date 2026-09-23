import type { Metadata } from "next";
import Link from "next/link";
import { DayIcon, type DayIconName } from "@/components/day-site/icons";
import { GuideView, PageHead } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";
import { requireDayViewer } from "@/lib/day-access";

export const revalidate = 60;
export const metadata: Metadata = { title: "Competitors" };

const SHORTCUTS: { href: string; label: string; hint: string; icon: DayIconName }[] = [
  { href: "/day/teams", label: "Your team page", hint: "Your runs, your score, your seed", icon: "teams" },
  { href: "/day/standings", label: "Where you stand", hint: "The qualifying table", icon: "standings" },
  { href: "/day/bracket", label: "The bracket", hint: "Who you could meet", icon: "bracket" },
  { href: "/day/schedule", label: "Running order", hint: "When everything happens", icon: "schedule" },
];

export default async function DayCompetitorsPage() {
  await requireDayViewer();
  const guide = await loadGuide("competitors");
  return (
    <div className="space-y-12">
      <PageHead kicker={guide.kicker} title={guide.title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="day-card p-6 sm:p-10">
          <GuideView blocks={guide.blocks} />
        </div>
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="day-card overflow-hidden p-6" data-reveal>
            <p className="day-kicker">Your eight minutes</p>
            <p className="day-display mt-3 text-xl leading-snug text-day-ink">Score = successful runs ÷ official time × 1000</p>
            <p className="mt-3 text-sm leading-relaxed text-day-muted">
              Every run that reaches the centre counts. Your official time is the fastest of them.
            </p>
          </div>
          {SHORTCUTS.map((item, index) => (
            <Link key={item.href} href={item.href} className="day-card day-lift flex items-center gap-4 p-4" data-reveal style={{ ["--i" as string]: index + 1 }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-day-crimson/10 text-day-crimson">
                <DayIcon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-day-ink">{item.label}</span>
                <span className="block text-sm text-day-muted">{item.hint}</span>
              </span>
              <DayIcon name="arrow" className="h-4 w-4 text-day-faint" />
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
