import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule",
  description: "Key dates for MMRC 26.",
};

export default async function SchedulePage() {
  const schedule = await prisma.scheduleEvent.findMany({ orderBy: { startsAt: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Schedule
      </h1>
      <ol className="mt-8 space-y-4">
        {schedule.map((item) => (
          <li key={item.id}>
            <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display font-bold text-ras-purple dark:text-white">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
                  {item.description}
                </p>
                {item.location ? (
                  <p className="mt-1 text-xs text-ras-gray dark:text-white/50">{item.location}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Badge>
                  <time dateTime={item.startsAt.toISOString()}>
                    {item.startsAt.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </Badge>
                <a
                  href={`/api/schedule/${item.id}/ics`}
                  download
                  className="text-xs font-semibold text-ras-crimson hover:underline"
                >
                  Add to calendar
                </a>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
