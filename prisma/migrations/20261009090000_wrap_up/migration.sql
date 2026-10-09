-- After the competition: the wrap-up homepage and the developer's message.
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "wrapUp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "developerMessage" TEXT NOT NULL DEFAULT '';
