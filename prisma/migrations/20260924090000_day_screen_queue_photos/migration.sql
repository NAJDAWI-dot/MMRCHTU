-- AlterTable
ALTER TABLE "CompetitionDayConfig" ADD COLUMN     "dayAlbumId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "queueCalledAt" TIMESTAMP(3),
ADD COLUMN     "queueHistory" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "queueTeamId" TEXT NOT NULL DEFAULT '';
