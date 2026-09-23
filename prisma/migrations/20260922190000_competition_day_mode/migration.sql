-- Day mode: additive only. Every deploy, previews included, runs migrations
-- against the production database, so nothing here may drop or rewrite data.

-- AlterTable
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "dayMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DayAnnouncement" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayAnnouncement_isPublished_createdAt_idx" ON "DayAnnouncement"("isPublished", "createdAt");
