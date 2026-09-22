import type { Metadata } from "next";
import Link from "next/link";
import { GuideView, PageHead } from "@/components/day-site/ui";
import { loadGuide } from "@/lib/day-guide-server";

export const revalidate = 60;
export const metadata: Metadata = { title: "Competitors" };

const SHORTCUTS = [
  { href: "/day/standings", label: "Where you stand", hint: "The qualifying table" },
  { href: "/day/bracket", label: "The bracket", hint: "Who you could meet" },
  { href: "/day/schedule", label: "Running order", hint: "When everything happens" },
  { href: "/day/teams", label: "Your team page", hint: "Find your team" },
];

export default async function DayCompetitorsPage() {
  const guide = await loadGuide("competitors");
  return (
    <div className="space-y-10">
      <PageHead kicker={guide.kicker} title={guide.title} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="day-glass p-6 sm:p-10">
          <GuideView blocks={guide.blocks} />
        </div>
        <aside className="space-y-3 lg:sticky lg:top-40 lg:self-start">
          {SHORTCUTS.map((item) => (
            <Link key={item.href} href={item.href} className="day-card day-glass block p-4">
              <span className="block font-semibold text-white">{item.label} →</span>
              <span className="text-sm text-[var(--day-muted)]">{item.hint}</span>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
