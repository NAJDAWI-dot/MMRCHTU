-- Robot names and pit tables are no longer kept on the day.
ALTER TABLE "TeamDayStatus" DROP COLUMN "robotName";
ALTER TABLE "TeamDayStatus" DROP COLUMN "pit";

-- The organisers' own team codes.
ALTER TABLE "TeamDayStatus" ADD COLUMN "teamCode" TEXT NOT NULL DEFAULT '';

-- A knockout of 32 or 16.
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "bracketSize" INTEGER NOT NULL DEFAULT 32;
