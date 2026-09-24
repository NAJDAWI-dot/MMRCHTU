-- Every run of a match sheet, successful or not, in the order it was run.
ALTER TABLE "QualifyingRun" ADD COLUMN "runLog" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "KnockoutMatch" ADD COLUMN "runLogA" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "KnockoutMatch" ADD COLUMN "runLogB" JSONB NOT NULL DEFAULT '[]';

-- A qualifying slot time set by hand or imported.
ALTER TABLE "TeamDayStatus" ADD COLUMN "slotTime" TEXT NOT NULL DEFAULT '';
