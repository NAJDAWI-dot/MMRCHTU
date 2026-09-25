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
        <div className="min-w-0">
          <GuideView blocks={guide.blocks} />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="day-floor day-posts p-6" data-reveal>
            <p className="text-sm font-semibold text-day-crimson">Your eight minutes</p>
            <p className="day-display mt-3 text-xl leading-snug text-day-ink">Score = successful runs ÷ official time × 1000</p>
            <p className="mt-3 text-sm leading-relaxed text-day-muted">
              Every run that reaches the centre counts. Your official time is the fastest of them.
            </p>
          </div>
          <ul className="border-t-2 border-day-line/85" data-reveal>
            {SHORTCUTS.map((item) => (
              <li key={item.href} className="border-b border-day-line/[0.12]">
                <Link href={item.href} className="group flex items-center gap-3.5 px-1 py-3.5 transition-colors hover:bg-day-ink/[0.03]">
                  <DayIcon name={item.icon} className="h-5 w-5 shrink-0 text-day-muted transition-colors group-hover:text-day-crimson" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-day-ink">{item.label}</span>
                    <span className="block text-sm text-day-muted">{item.hint}</span>
                  </span>
                  <DayIcon name="arrow" className="h-4 w-4 text-day-ink transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
