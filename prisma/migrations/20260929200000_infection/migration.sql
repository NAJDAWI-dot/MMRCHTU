-- The week before competition day: the main site turns into the day site.
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "infection" BOOLEAN NOT NULL DEFAULT true;
