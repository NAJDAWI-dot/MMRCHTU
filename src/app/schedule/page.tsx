import type { Metadata } from "next";
import { loadSchedule } from "@/lib/mdx";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Schedule",
  description: "Key dates for MMRC 26.",
};

export default async function SchedulePage() {
  const schedule = await loadSchedule();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Schedule
      </h1>
      <ol className="mt-8 space-y-4">
        {schedule.map((item) => (
          <li key={`${item.date}-${item.title}`}>
            <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display font-bold text-ras-purple dark:text-white">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
                  {item.description}
                </p>
              </div>
              <Badge>
                <time dateTime={item.date}>
                  {new Date(item.date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </Badge>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
