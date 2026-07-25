import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { parseStatus, toParagraphs } from "@/lib/competition-day";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Competition Day",
  description: "Date, venue, and running order for MMRC 26 competition day.",
};

export default async function CompetitionDayPage() {
  const config = await prisma.competitionDayConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const status = parseStatus(config.status);
  if (status === "HIDDEN") notFound();

  const published = status === "PUBLISHED";
  const paragraphs = toParagraphs(config.details);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        {config.headline}
      </h1>
      {config.intro ? (
        <p className="mt-3 text-ras-gray dark:text-white/70">{config.intro}</p>
      ) : null}

      {published ? (
        <>
          {(config.dateText || config.venue) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {config.dateText ? <Badge>{config.dateText}</Badge> : null}
              {config.venue ? <Badge>{config.venue}</Badge> : null}
            </div>
          )}

          {paragraphs.length > 0 ? (
            <div className="mt-8 space-y-4">
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line leading-relaxed text-ras-gray dark:text-white/80">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            // Published with nothing written yet — fall back to the holding
            // message rather than showing an empty page.
            <Card className="mt-8">
              <p className="text-ras-gray dark:text-white/80">{config.comingSoonText}</p>
            </Card>
          )}
        </>
      ) : (
        <Card className="mt-8 text-center">
          <p className="text-lg font-medium text-ras-purple dark:text-white">{config.comingSoonText}</p>
          <p className="mt-3 text-sm text-ras-gray dark:text-white/60">
            Check the{" "}
            <a href="/schedule" className="font-semibold text-ras-crimson hover:underline">
              schedule
            </a>{" "}
            for the key dates we have already announced.
          </p>
        </Card>
      )}
    </div>
  );
}
