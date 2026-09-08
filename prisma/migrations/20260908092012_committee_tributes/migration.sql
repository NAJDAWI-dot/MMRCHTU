-- AlterTable
ALTER TABLE "CommitteeMember" ADD COLUMN     "stageKey" TEXT,
ADD COLUMN     "stageUrl" TEXT,
ADD COLUMN     "tribute" TEXT NOT NULL DEFAULT '';
