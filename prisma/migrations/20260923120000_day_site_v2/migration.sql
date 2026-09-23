-- AlterTable
ALTER TABLE "CompetitionDayConfig" ADD COLUMN     "runOrderDrawnAt" TIMESTAMP(3),
ADD COLUMN     "runOrderStart" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "runSlotMinutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "TeamDayStatus" ADD COLUMN     "badges" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deskNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "presentIds" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "runOrder" INTEGER;

-- AlterTable
ALTER TABLE "QualifyingRun" ADD COLUMN     "remaining" DOUBLE PRECISION,
ADD COLUMN     "runTimes" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ALTER COLUMN "score" DROP NOT NULL;

-- AlterTable
ALTER TABLE "KnockoutMatch" ADD COLUMN     "remainingA" DOUBLE PRECISION,
ADD COLUMN     "remainingB" DOUBLE PRECISION,
ADD COLUMN     "timesA" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "timesB" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- AlterTable
ALTER TABLE "DayAnnouncement" ADD COLUMN     "isAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'INFO';

-- CreateTable
CREATE TABLE "DaySlot" (
    "id" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DaySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DaySlot_startTime_idx" ON "DaySlot"("startTime");

