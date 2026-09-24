-- What the public day site holds back, by phase.
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "hiddenResults" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "hiddenAdvance" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "lastReveal" TEXT NOT NULL DEFAULT '';

-- The judges' say over the table and the sheets.
ALTER TABLE "TeamDayStatus" ADD COLUMN "qualifyOverride" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KnockoutMatch" ADD COLUMN "winnerOverride" BOOLEAN NOT NULL DEFAULT false;
